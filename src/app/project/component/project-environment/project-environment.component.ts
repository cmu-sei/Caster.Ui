// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { filter, switchMap, take } from 'rxjs/operators';
import {
  EnvironmentSetValueSource,
  InventoryConnection,
  InventoryService as InventoryApiService,
  ProjectInventoryService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';
import { ProjectEnvironmentSetsViewComponent } from 'src/app/environment-sets/project-environment-sets-view/project-environment-sets-view.component';
import { PermissionService } from 'src/app/permissions/permission.service';
import { AssignmentChecklistComponent } from 'src/app/assignments/assignment-checklist/assignment-checklist.component';
import {
  AssignmentItem,
  assignmentDiff,
  saveLabel,
  sameName,
} from 'src/app/assignments/assignment.model';
import {
  AssignmentService,
  projectConnectionChanges,
  projectSetChanges,
} from 'src/app/assignments/assignment.service';

export interface ProjectEnvironmentData {
  projectId: string;
  projectName?: string;
}

/** A set that reads a connection the project doesn't show yet, offered while assigning. */
export interface ConnectionHint {
  setName: string;
  connectionName: string;
}

/**
 * A project's environment: the Environment Sets its runs get, and the infrastructure
 * connections whose inventory its members see. Everyone who can see the project sees both;
 * admins change them here in one save, as a quick alternative to the sets' and connections'
 * own pages. Sets need ManageEnvironmentSets, connections ManageInfrastructure.
 */
@Component({
  selector: 'cas-project-environment',
  templateUrl: './project-environment.component.html',
  styleUrls: ['./project-environment.component.scss'],
  imports: [
    MatButton,
    MatIcon,
    MatTabGroup,
    MatTab,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    ProjectEnvironmentSetsViewComponent,
    AssignmentChecklistComponent,
  ],
})
export class ProjectEnvironmentComponent implements OnInit {
  readonly data = inject<ProjectEnvironmentData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProjectEnvironmentComponent>);
  private projectInventoryApi = inject(ProjectInventoryService);
  private inventoryApi = inject(InventoryApiService);
  private environmentSetService = inject(EnvironmentSetService);
  private assignmentService = inject(AssignmentService);
  private permissionService = inject(PermissionService);

  private readonly canManageInfrastructure$ =
    this.permissionService.hasPermission(SystemPermission.ManageInfrastructure);
  private readonly canManageSets$ = this.permissionService.hasPermission(
    SystemPermission.ManageEnvironmentSets,
  );
  readonly canManageInfrastructure = toSignal(this.canManageInfrastructure$, {
    initialValue: false,
  });
  readonly canManageSets = toSignal(this.canManageSets$, {
    initialValue: false,
  });
  readonly canChange = computed(
    () => this.canManageSets() || this.canManageInfrastructure(),
  );

  /** The project's connections, as its members see them. */
  readonly connections = signal<InventoryConnection[]>([]);
  /** Every configured connection, for ManageInfrastructure holders. */
  private readonly allConnections = signal<InventoryConnection[]>([]);
  private readonly allSets = toSignal(this.environmentSetService.sets$, {
    initialValue: [],
  });
  readonly projectSets = toSignal(
    this.environmentSetService.projectSets$(this.data.projectId),
    { initialValue: null },
  );

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly initialSets = signal<string[]>([]);
  readonly selectedSets = signal<string[]>([]);
  readonly initialConnections = signal<string[]>([]);
  readonly selectedConnections = signal<string[]>([]);

  /** A set the project gets through its group is shown checked, and changed on the group. */
  readonly setItems = computed<AssignmentItem[]>(() =>
    this.allSets().map((x) => {
      const assigned = (this.projectSets() ?? []).find(
        (p) => p.environmentSetId === x.id,
      );
      const groups = (assigned?.projectGroups ?? []).map((g) => g.name ?? '');
      return {
        id: x.id,
        name: x.name ?? '',
        detail: x.description,
        locked: !!assigned && assigned.isDirect === false,
        notes: groups.map((g) =>
          assigned?.isDirect === false
            ? `via group ${g}`
            : `also via group ${g}`,
        ),
      };
    }),
  );

  /** Every configured connection, and any assigned one that has left configuration. Keyed by lower-case name. */
  readonly connectionItems = computed<AssignmentItem[]>(() => {
    const assignedTo = (name: string | null | undefined) =>
      this.connections().find((c) => sameName(c.name, name));
    const viaGroup = (name: string | null | undefined) => {
      const assigned = assignedTo(name);
      return {
        locked: !!assigned && assigned.isDirect === false,
        notes: (assigned?.projectGroups ?? []).map((g) =>
          assigned?.isDirect === false
            ? `via group ${g}`
            : `also via group ${g}`,
        ),
      };
    };
    const items: AssignmentItem[] = this.allConnections().map((x) => ({
      id: connectionKey(x.name),
      name: x.name ?? '',
      detail: x.enabled === false ? 'Inventory turned off' : null,
      ...viaGroup(x.name),
    }));
    for (const assigned of this.connections()) {
      if (!items.some((x) => x.id === connectionKey(assigned.name))) {
        items.push({
          id: connectionKey(assigned.name),
          name: assigned.name ?? '',
          detail: 'Not configured',
          warn: true,
          ...viaGroup(assigned.name),
        });
      }
    }
    return items;
  });

  /** The connections the chosen sets read that the project wouldn't show, for ManageInfrastructure holders. */
  readonly hints = computed<ConnectionHint[]>(() => {
    if (!this.editing() || !this.canManageInfrastructure()) {
      return [];
    }

    const shown = new Set([
      ...this.selectedConnections(),
      ...this.connections()
        .filter((x) => x.isDirect === false)
        .map((x) => connectionKey(x.name)),
    ]);
    const configured = this.allConnections();
    const hints: ConnectionHint[] = [];
    for (const id of this.selectedSets()) {
      const set = this.allSets().find((x) => x.id === id);
      for (const entry of set?.entries ?? []) {
        const name = entry.connectionName;
        if (
          entry.valueSource === EnvironmentSetValueSource.Connection &&
          name &&
          !shown.has(connectionKey(name)) &&
          configured.some((x) => sameName(x.name, name)) &&
          !hints.some((x) => sameName(x.connectionName, name))
        ) {
          hints.push({ setName: set.name ?? '', connectionName: name });
        }
      }
    }
    return hints;
  });

  /** Whether the project gets anything through its group. */
  readonly throughGroup = computed(
    () =>
      (this.projectSets() ?? []).some((x) => x.isDirect === false) ||
      this.connections().some((x) => x.isDirect === false),
  );

  private readonly setDiff = computed(() =>
    this.canManageSets()
      ? assignmentDiff(this.initialSets(), this.selectedSets())
      : { add: [], remove: [] },
  );

  private readonly connectionDiff = computed(() =>
    this.canManageInfrastructure()
      ? assignmentDiff(this.initialConnections(), this.selectedConnections())
      : { add: [], remove: [] },
  );

  readonly changeCount = computed(
    () =>
      this.setDiff().add.length +
      this.setDiff().remove.length +
      this.connectionDiff().add.length +
      this.connectionDiff().remove.length,
  );

  readonly saveLabel = computed(() => saveLabel(this.changeCount()));

  ngOnInit(): void {
    this.loadConnections();
    this.environmentSetService
      .loadProjectSets(this.data.projectId)
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });

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
        switchMap(() => this.environmentSetService.load()),
      )
      .subscribe();
  }

  /** Starts from what is assigned to the project itself; what comes through its group stays. */
  edit(): void {
    this.initialSets.set(
      (this.projectSets() ?? [])
        .filter((x) => x.isDirect !== false)
        .map((x) => x.environmentSetId),
    );
    this.selectedSets.set(this.initialSets());
    this.initialConnections.set(
      this.connections()
        .filter((x) => x.isDirect !== false)
        .map((x) => connectionKey(x.name)),
    );
    this.selectedConnections.set(this.initialConnections());
    this.error.set(null);
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
    this.error.set(null);
  }

  showConnection(hint: ConnectionHint): void {
    this.selectedConnections.update((x) => [
      ...x,
      connectionKey(hint.connectionName),
    ]);
  }

  /** Saves the set and connection changes in one request, checked together. */
  save(): void {
    if (this.saving() || this.changeCount() === 0) {
      return;
    }

    const names = new Map(this.connectionItems().map((x) => [x.id, x.name]));
    const connections = this.connectionDiff();
    const changes = [
      ...projectSetChanges(this.data.projectId, this.setDiff()),
      ...projectConnectionChanges(this.data.projectId, {
        add: connections.add.map((x) => names.get(x) ?? x),
        remove: connections.remove.map((x) => names.get(x) ?? x),
      }),
    ];

    this.saving.set(true);
    this.error.set(null);
    this.assignmentService.edit(changes).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.loadConnections();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
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

  private loadConnections(): void {
    this.projectInventoryApi
      .getProjectInventoryConnections(this.data.projectId)
      .subscribe({
        next: (x) => this.connections.set(x ?? []),
        error: (err) => this.error.set(apiErrorMessage(err)),
      });
  }
}

function connectionKey(name: string | null | undefined): string {
  return (name ?? '').toLowerCase();
}
