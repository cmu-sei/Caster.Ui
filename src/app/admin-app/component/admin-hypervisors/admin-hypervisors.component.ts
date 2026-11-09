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
import { MatIconButton } from '@angular/material/button';
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
} from 'src/app/generated/caster-api';
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
 * CPU, memory and storage use on each hypervisor Caster has an inventory
 * connection to, for admins planning whether an exercise will fit. Read from
 * the same cache as the project Infrastructure panel, so the figures are as old
 * as the last inventory read; Refresh re-reads that one connection.
 */
@Component({
  selector: 'cas-admin-hypervisors',
  templateUrl: './admin-hypervisors.component.html',
  styleUrls: ['./admin-hypervisors.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
              ? 'Hypervisor inventory is not available on this Caster API.'
              : 'Hypervisor inventory could not be read right now.',
          );
          this.loading.set(false);
        },
      });
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
