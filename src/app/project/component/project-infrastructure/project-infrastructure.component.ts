// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogService,
} from '@cmusei/crucible-common';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import {
  EnvironmentSet,
  EnvironmentSetValueSource,
  InventoryConnection,
  InventoryService as InventoryApiService,
  ProjectEnvironmentSet,
  ProjectInventoryService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';
import { ProjectEnvironmentSetsViewComponent } from 'src/app/environment-sets/project-environment-sets-view/project-environment-sets-view.component';
import { PermissionService } from 'src/app/permissions/permission.service';

export interface ProjectInfrastructureData {
  projectId: string;
  projectName?: string;
}

/**
 * A project's infrastructure: the connections whose inventory its members see, and the
 * Environment Sets its runs get. Assigned separately: a connection gives inventory, a set
 * gives credentials. Assigning a connection needs ManageInfrastructure, a set
 * ManageEnvironmentSets; everyone who can see the project sees both lists.
 */
@Component({
  selector: 'cas-project-infrastructure',
  templateUrl: './project-infrastructure.component.html',
  styleUrls: ['./project-infrastructure.component.scss'],
  imports: [
    AsyncPipe,
    FormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatIcon,
    MatSelect,
    MatOption,
    MatTooltip,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    ProjectEnvironmentSetsViewComponent,
  ],
})
export class ProjectInfrastructureComponent implements OnInit {
  readonly data = inject<ProjectInfrastructureData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProjectInfrastructureComponent>);
  private projectInventoryApi = inject(ProjectInventoryService);
  private inventoryApi = inject(InventoryApiService);
  private environmentSetService = inject(EnvironmentSetService);
  private permissionService = inject(PermissionService);
  private confirmService = inject(CrucibleDialogService);

  readonly canManageInfrastructure$: Observable<boolean> =
    this.permissionService.hasPermission(SystemPermission.ManageInfrastructure);
  /** Assigning a set lists every set, so it also needs ViewEnvironmentSets, which managing implies. */
  readonly canManageSets$: Observable<boolean> =
    this.permissionService.hasPermission(
      SystemPermission.ManageEnvironmentSets,
    );

  readonly connections = signal<InventoryConnection[]>([]);
  /** Every configured connection, for ManageInfrastructure holders to assign. */
  readonly allConnections = signal<InventoryConnection[]>([]);
  readonly error = signal<string | null>(null);

  readonly projectSets$: Observable<ProjectEnvironmentSet[] | null>;
  readonly allSets$ = this.environmentSetService.sets$;

  selectedConnection: string | null = null;
  selectedSet: string | null = null;

  constructor() {
    this.projectSets$ = this.environmentSetService.projectSets$(
      this.data.projectId,
    );
  }

  ngOnInit(): void {
    this.projectInventoryApi
      .getProjectInventoryConnections(this.data.projectId)
      .subscribe({
        next: (x) => this.connections.set(x ?? []),
        error: (err) => this.error.set(apiErrorMessage(err)),
      });

    this.canManageInfrastructure$
      .pipe(
        filter((x) => x),
        take(1),
        switchMap(() => this.inventoryApi.getInventoryConnections()),
      )
      .subscribe((x) => this.allConnections.set(x ?? []));

    this.canManageSets$
      .pipe(
        filter((x) => x),
        take(1),
      )
      .subscribe(() => this.environmentSetService.load().subscribe());
  }

  /** The configured connections not yet assigned. */
  assignableConnections(): InventoryConnection[] {
    const assigned = new Set(
      this.connections().map((x) => (x.name ?? '').toLowerCase()),
    );
    return this.allConnections().filter(
      (x) => !assigned.has((x.name ?? '').toLowerCase()),
    );
  }

  assignableSets(
    all: EnvironmentSet[] | null,
    assigned: ProjectEnvironmentSet[] | null,
  ): EnvironmentSet[] {
    const ids = new Set((assigned ?? []).map((x) => x.environmentSetId));
    return (all ?? []).filter((x) => !ids.has(x.id));
  }

  assignConnection(name: string | null): void {
    if (!name) {
      return;
    }

    this.error.set(null);
    this.projectInventoryApi
      .assignProjectInventoryConnection(this.data.projectId, name)
      .subscribe({
        next: (x) => {
          this.connections.set(x ?? []);
          this.selectedConnection = null;
        },
        error: (err) => this.error.set(apiErrorMessage(err)),
      });
  }

  unassignConnection(connection: InventoryConnection): void {
    this.confirmService
      .confirm({
        title: 'Remove Connection',
        message: `Stop showing ${connection.name}'s inventory to this project? Its Environment Sets are not changed.`,
        confirmText: 'Remove',
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() =>
          this.projectInventoryApi.unassignProjectInventoryConnection(
            this.data.projectId,
            connection.name,
          ),
        ),
      )
      .subscribe({
        next: (x) => this.connections.set(x ?? []),
        error: (err) => this.error.set(apiErrorMessage(err)),
      });
  }

  /**
   * Assigns a set, then offers to show the inventory of the connections its entries
   * read, when they aren't assigned yet and the user can assign them.
   */
  assignSet(setId: string | null): void {
    if (!setId) {
      return;
    }

    this.error.set(null);
    this.environmentSetService
      .assign(this.data.projectId, setId)
      .pipe(
        switchMap((set) =>
          combineLatest([of(set), this.canManageInfrastructure$.pipe(take(1))]),
        ),
      )
      .subscribe({
        next: ([set, canAssign]) => {
          this.selectedSet = null;
          if (canAssign) {
            this.offerConnections(set);
          }
        },
        error: (err) => this.error.set(apiErrorMessage(err)),
      });
  }

  unassignSet(set: ProjectEnvironmentSet): void {
    this.confirmService
      .confirm({
        title: 'Remove Environment Set',
        message: `Remove ${set.name} from this project? Its next runs will not get these variables.`,
        confirmText: 'Remove',
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() =>
          this.environmentSetService.unassign(
            this.data.projectId,
            set.environmentSetId,
          ),
        ),
        catchError((err) => {
          this.error.set(apiErrorMessage(err));
          return of(null);
        }),
      )
      .subscribe();
  }

  connectionStatus(connection: InventoryConnection): string {
    if (connection.status === 'Missing') {
      return 'Not configured';
    }
    return connection.enabled ? 'Available' : 'Inventory turned off';
  }

  close(): void {
    this.dialogRef.close();
  }

  private offerConnections(set: EnvironmentSet): void {
    const assigned = new Set(
      this.connections().map((x) => (x.name ?? '').toLowerCase()),
    );
    const names = [
      ...new Set(
        (set.entries ?? [])
          .filter(
            (x) =>
              x.valueSource === EnvironmentSetValueSource.Connection &&
              !!x.connectionName,
          )
          .map((x) => x.connectionName),
      ),
    ].filter(
      (name) =>
        !assigned.has(name.toLowerCase()) &&
        this.allConnections().some(
          (x) => (x.name ?? '').toLowerCase() === name.toLowerCase(),
        ),
    );

    for (const name of names) {
      this.confirmService
        .confirm({
          title: 'Show Inventory',
          message: `${set.name} reads connection ${name}. Also show ${name}'s inventory to this project?`,
          confirmText: 'Show inventory',
          cancelText: 'Not now',
        })
        .afterClosed()
        .pipe(filter((confirmed) => !!confirmed))
        .subscribe(() => this.assignConnection(name));
    }
  }
}
