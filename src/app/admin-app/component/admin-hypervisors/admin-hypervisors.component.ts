// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCard } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take } from 'rxjs/operators';
import {
  InventoryResult,
  InventoryCategory as ApiInventoryCategory,
  InventoryService as InventoryApiService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import {
  AssignmentService,
  connectionGroupChanges,
  connectionProjectChanges,
} from 'src/app/assignments/assignment.service';
import {
  AssignmentDialogComponent,
  AssignmentDialogData,
} from 'src/app/assignments/assignment-dialog/assignment-dialog.component';
import {
  connectionReads,
  datastoreUsage,
  formatBytes,
  hostUsage,
  InventoryConnection,
  InventoryHostUsage,
  InventoryItem,
  InventoryUsage,
  providerName,
} from 'src/app/inventory/state';

/** One list as the page shows it, from the API's `InventoryResult`. */
export interface HypervisorList {
  items: InventoryItem[];
  lastUpdated: string | null;
  available: boolean;
  /** False when the connection's settings turn this kind of object off. */
  enabled: boolean;
  stale: boolean;
  error: string | null;
}

/** One connection's hosts and datastores, as the page shows them. */
export interface HypervisorConnectionView {
  connection: InventoryConnection;
  /** Null until loaded, or when the request itself failed. */
  hosts: HypervisorList | null;
  datastores: HypervisorList | null;
  loading: boolean;
  refreshing: boolean;
}

function toList(result: InventoryResult | null): HypervisorList | null {
  return result
    ? {
        items: result.items ?? [],
        lastUpdated: result.lastUpdated ?? null,
        available: result.available !== false,
        enabled: result.enabled !== false,
        stale: result.stale === true,
        error: result.error ?? null,
      }
    : null;
}

/**
 * The infrastructure connections: the projects each is assigned to, and CPU,
 * memory and storage use on each hypervisor, for admins planning whether an
 * exercise will fit. Read from the same cache as the project Inventory panel,
 * so the figures are as old as the last inventory read; Refresh re-reads that
 * one connection. ManageInfrastructure holders assign connections to projects.
 */
@Component({
  selector: 'cas-admin-hypervisors',
  templateUrl: './admin-hypervisors.component.html',
  styleUrls: ['./admin-hypervisors.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatCard,
    MatIcon,
    MatIconButton,
    MatProgressBar,
    MatProgressSpinner,
    MatTooltip,
  ],
})
export class AdminHypervisorsComponent implements OnInit {
  private inventoryApiService = inject(InventoryApiService);
  private assignmentService = inject(AssignmentService);
  private dialog = inject(MatDialog);

  readonly canManage = toSignal(
    inject(PermissionService).hasPermission(
      SystemPermission.ManageInfrastructure,
    ),
    { initialValue: false },
  );

  readonly connections = signal<HypervisorConnectionView[]>([]);
  readonly loading = signal(true);
  /** Set when the connection list itself could not be read. */
  readonly error = signal<string | null>(null);

  readonly formatBytes = formatBytes;

  ngOnInit() {
    this.inventoryApiService
      .getInventoryConnections()
      .pipe(take(1))
      .subscribe({
        next: (connections) => {
          this.connections.set(
            (connections ?? []).map((connection) => ({
              connection,
              hosts: null,
              datastores: null,
              loading: true,
              refreshing: false,
            })),
          );
          this.loading.set(false);
          for (const connection of connections ?? []) {
            // A misconfigured connection isn't read; its card says why.
            if (!connection.error) {
              this.load(connection.name ?? '')
                .pipe(take(1))
                .subscribe();
            }
          }
        },
        error: (error: unknown) => {
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'Inventory is not available on this Caster API.'
              : 'Inventory could not be read right now.',
          );
          this.loading.set(false);
        },
      });
  }

  /** Adds and removes the connection's projects together. */
  assign(connection: InventoryConnection) {
    const name = connection.name ?? '';
    forkJoin([
      this.assignmentService.projectItems(),
      this.assignmentService.groupItems(),
    ]).subscribe(([projects, groups]) =>
      this.dialog
        .open<AssignmentDialogComponent, AssignmentDialogData>(
          AssignmentDialogComponent,
          {
            data: {
              title: `Assign ${name}`,
              description: `Projects see ${name}'s inventory in their Inventory panel. A connection gives inventory, not credentials: those come from Environment Sets.`,
              sections: [
                {
                  label: 'Projects',
                  items: projects,
                  assigned: (connection.projects ?? []).map((x) => x.projectId),
                  searchLabel: 'Search projects',
                  emptyText: 'There are no projects.',
                },
                {
                  label: 'Project Groups',
                  items: groups,
                  assigned: (connection.assignedProjectGroups ?? []).map(
                    (x) => x.projectGroupId,
                  ),
                  searchLabel: 'Search project groups',
                  emptyText: 'There are no project groups.',
                },
              ],
              save: ([toProjects, toGroups]) =>
                this.assignmentService.edit([
                  ...connectionProjectChanges(name, toProjects),
                  ...connectionGroupChanges(name, toGroups),
                ]),
            },
            width: '640px',
            maxWidth: '90vw',
            disableClose: true,
          },
        )
        .afterClosed()
        .subscribe((saved) => {
          if (saved) {
            this.reloadProjects();
          }
        }),
    );
  }

  /** Re-reads the connection list for its projects, keeping what each card has loaded. */
  private reloadProjects() {
    this.inventoryApiService
      .getInventoryConnections()
      .pipe(take(1))
      .subscribe((connections) =>
        this.connections.update((views) =>
          views.map((view) => {
            const updated = (connections ?? []).find(
              (x) => x.name === view.connection.name,
            );
            return updated ? { ...view, connection: updated } : view;
          }),
        ),
      );
  }

  /** Asks the API to re-read one connection, then shows what it read. */
  refresh(name: string | null | undefined) {
    name = name ?? '';
    this.patch(name, { refreshing: true });
    this.inventoryApiService
      .refreshInventory(name)
      .pipe(
        catchError(() => of(null)),
        switchMap(() => this.load(name)),
        finalize(() => this.patch(name, { refreshing: false })),
        take(1),
      )
      .subscribe();
  }

  hostUsage(item: InventoryItem): InventoryHostUsage {
    return hostUsage(item);
  }

  datastoreUsage(item: InventoryItem): InventoryUsage | null {
    return datastoreUsage(item);
  }

  /** Green, then amber past 75%, red past 90%. */
  level(percent: number): 'ok' | 'warn' | 'high' {
    return percent >= 90 ? 'high' : percent >= 75 ? 'warn' : 'ok';
  }

  /** When a connection was last read, in the viewer's time zone. */
  readTime(value: string | null | undefined): string {
    return value
      ? new Date(value).toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : '';
  }

  /** "Proxmox", "vSphere", or the provider as configured. */
  providerName(provider: string | null | undefined): string {
    return providerName(provider);
  }

  /** Whether the connection's settings read hosts. */
  readsHosts(connection: InventoryConnection): boolean {
    return connectionReads(connection, ApiInventoryCategory.Host);
  }

  /** Whether the connection's settings read datastores. */
  readsDatastores(connection: InventoryConnection): boolean {
    return connectionReads(connection, ApiInventoryCategory.Datastore);
  }

  /**
   * A transport failure leaves that list null, so the other list and the
   * other connections still show.
   */
  private load(name: string): Observable<void> {
    this.patch(name, { loading: true });
    return forkJoin({
      hosts: this.inventoryApiService
        .getInventoryHosts(name)
        .pipe(catchError(() => of(null))),
      datastores: this.inventoryApiService
        .getInventoryDatastores(name)
        .pipe(catchError(() => of(null))),
    }).pipe(
      map(({ hosts, datastores }) =>
        this.patch(name, {
          hosts: toList(hosts),
          datastores: toList(datastores),
          loading: false,
        }),
      ),
    );
  }

  private patch(name: string, changes: Partial<HypervisorConnectionView>) {
    this.connections.update((views) =>
      views.map((view) =>
        view.connection.name === name ? { ...view, ...changes } : view,
      ),
    );
  }
}
