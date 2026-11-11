// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { Observable, concat, of, toArray } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import {
  CreateProjectMembershipCommand,
  EditProjectMembershipCommand,
  EnvironmentSet,
  EnvironmentSetsService,
  Group,
  GroupsService,
  InventoryConnection,
  InventoryService,
  Partition,
  Project,
  ProjectGroup,
  ProjectGroupMembership,
  ProjectGroupsService,
  ProjectMembership,
  ProjectPermission,
  ProjectPermissionsClaim,
  ProjectPermissionsService,
  ProjectRole,
  ProjectRolesService,
  ProjectsService,
  SystemPermission,
  User,
  UsersService,
  VlansService,
} from 'src/app/generated/caster-api';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';
import { PermissionService } from 'src/app/permissions/permission.service';
import { AssignmentChecklistComponent } from 'src/app/assignments/assignment-checklist/assignment-checklist.component';
import {
  AssignmentItem,
  assignmentDiff,
  saveLabel,
} from 'src/app/assignments/assignment.model';
import {
  AssignmentService,
  groupConnectionChanges,
  groupSetChanges,
} from 'src/app/assignments/assignment.service';
import { ProjectMembershipListComponent } from 'src/app/project/component/project-memberships/project-membership-list/project-membership-list.component';
import { ProjectMemberListComponent } from 'src/app/project/component/project-memberships/project-member-list/project-member-list.component';
import { ProjectGroupService } from '../project-group.service';

/**
 * One project group, a tab for each part: its projects, memberships, Environment Sets,
 * connections, and VLAN partition. Each part is editable by those who may: projects and
 * memberships by the group's managers and ManageProjectGroups, sets by ManageEnvironmentSets,
 * connections by ManageInfrastructure, the VLANs tab by ManageVLANs, who alone see it.
 */
@Component({
  selector: 'cas-project-group-detail',
  templateUrl: './project-group-detail.component.html',
  styleUrls: ['./project-group-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatFormField,
    MatLabel,
    MatIcon,
    MatSelect,
    MatOption,
    MatTabGroup,
    MatTab,
    AssignmentChecklistComponent,
    ProjectMembershipListComponent,
    ProjectMemberListComponent,
    NgTemplateOutlet,
  ],
})
export class ProjectGroupDetailComponent implements OnInit {
  private groupService = inject(ProjectGroupService);
  private assignmentService = inject(AssignmentService);
  private permissionService = inject(PermissionService);
  private projectsApi = inject(ProjectsService);
  private projectGroupsApi = inject(ProjectGroupsService);
  private projectPermissionsApi = inject(ProjectPermissionsService);
  private usersApi = inject(UsersService);
  private groupsApi = inject(GroupsService);
  private rolesApi = inject(ProjectRolesService);
  private setsApi = inject(EnvironmentSetsService);
  private inventoryApi = inject(InventoryService);
  private vlansApi = inject(VlansService);
  private dialog = inject(MatDialog);

  readonly group = input.required<ProjectGroup>();

  readonly canManageSets = this.hasPermission(
    SystemPermission.ManageEnvironmentSets,
  );
  readonly canManageConnections = this.hasPermission(
    SystemPermission.ManageInfrastructure,
  );
  readonly canCreateProjects = this.hasPermission(
    SystemPermission.CreateProjects,
  );
  readonly canManageVlans = this.hasPermission(SystemPermission.ManageVlans);

  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  readonly memberships = signal<ProjectGroupMembership[]>([]);
  private readonly users = signal<User[]>([]);
  private readonly userGroups = signal<Group[]>([]);
  readonly roles = signal<ProjectRole[]>([]);
  /** The projects the user is a member of, and their permissions in each. */
  private readonly myProjects = signal<Project[]>([]);
  private readonly projectClaims = signal<ProjectPermissionsClaim[]>([]);
  /** Every project, for ManageProjects holders who may add any (and can list them all). */
  private readonly allProjects = signal<Project[] | null>(null);
  private readonly sets = signal<EnvironmentSet[]>([]);
  private readonly connections = signal<InventoryConnection[]>([]);
  readonly partitions = signal<Partition[]>([]);
  /** Every group the user can see, to name the one a project would move from. */
  private readonly groupNames = signal<ProjectGroup[]>([]);

  // ---- projects -------------------------------------------------------------------------------

  readonly initialProjects = computed(() =>
    (this.group().projects ?? []).map((x) => x.id),
  );
  readonly selectedProjects = linkedSignal(() => this.initialProjects());

  /**
   * The projects the user may add, as the API decides: ones they manage, out of no group or
   * one they also manage (the API checks again).
   */
  private readonly addableProjects = computed(() => {
    const all = this.allProjects();
    const managed = all
      ? all
      : this.myProjects().filter((p) =>
          this.projectClaims().some(
            (c) =>
              c.projectId === p.id &&
              (c.permissions ?? []).includes(ProjectPermission.ManageProject),
          ),
        );
    return managed.filter(
      (p) =>
        !p.projectGroupId ||
        p.projectGroupId === this.group().id ||
        !!this.groupNames().find((g) => g.id === p.projectGroupId)?.canManage,
    );
  });

  /** The group's projects and the ones the user may add; a project in another group moves. */
  readonly projectItems = computed<AssignmentItem[]>(() => {
    const items = new Map<string, AssignmentItem>();
    for (const p of this.group().projects ?? []) {
      items.set(p.id, { id: p.id, name: p.name ?? '' });
    }
    for (const p of this.addableProjects()) {
      if (!items.has(p.id)) {
        const other = this.groupNames().find((g) => g.id === p.projectGroupId);
        items.set(p.id, {
          id: p.id,
          name: p.name ?? '',
          detail: p.description,
          notes: other ? [`moves from ${other.name}`] : [],
        });
      }
    }
    return [...items.values()];
  });

  readonly projectChanges = computed(() =>
    assignmentDiff(this.initialProjects(), this.selectedProjects()),
  );

  // ---- memberships ----------------------------------------------------------------------------

  /** The project membership tables take the group's memberships as they are shaped alike. */
  readonly membershipRows = computed(
    () => this.memberships() as unknown as ProjectMembership[],
  );
  readonly members = computed(() =>
    this.users().filter((u) =>
      this.memberships().some((m) => m.userId === u.id),
    ),
  );
  readonly nonMembers = computed(() =>
    this.users().filter(
      (u) => !this.memberships().some((m) => m.userId === u.id),
    ),
  );
  readonly groupMembers = computed(() =>
    this.userGroups().filter((g) =>
      this.memberships().some((m) => m.groupId === g.id),
    ),
  );
  readonly groupNonMembers = computed(() =>
    this.userGroups().filter(
      (g) => !this.memberships().some((m) => m.groupId === g.id),
    ),
  );

  // ---- Environment Sets -----------------------------------------------------------------------

  readonly initialSets = computed(() =>
    (this.group().environmentSets ?? []).map((x) => x.id),
  );
  readonly selectedSets = linkedSignal(() => this.initialSets());
  readonly setItems = computed<AssignmentItem[]>(() => {
    const items: AssignmentItem[] = this.sets().map((x) => ({
      id: x.id,
      name: x.name ?? '',
      detail: x.description,
    }));
    for (const assigned of this.group().environmentSets ?? []) {
      if (!items.some((x) => x.id === assigned.id)) {
        items.push({ id: assigned.id, name: assigned.name ?? '' });
      }
    }
    return items;
  });
  readonly setChanges = computed(() =>
    assignmentDiff(this.initialSets(), this.selectedSets()),
  );

  // ---- connections ----------------------------------------------------------------------------

  readonly initialConnections = computed(() =>
    (this.group().inventoryConnections ?? []).map(connectionKey),
  );
  readonly selectedConnections = linkedSignal(() => this.initialConnections());
  readonly connectionItems = computed<AssignmentItem[]>(() => {
    const items: AssignmentItem[] = this.connections().map((x) => ({
      id: connectionKey(x.name),
      name: x.name ?? '',
      detail: x.enabled === false ? 'Inventory turned off' : null,
    }));
    for (const name of this.group().inventoryConnections ?? []) {
      if (!items.some((x) => x.id === connectionKey(name))) {
        items.push({
          id: connectionKey(name),
          name,
          detail: this.canManageConnections() ? 'Not configured' : null,
          warn: this.canManageConnections(),
        });
      }
    }
    return items;
  });
  readonly connectionChanges = computed(() =>
    assignmentDiff(this.initialConnections(), this.selectedConnections()),
  );

  /** The partition shown, put back to the stored one if a change is refused. */
  readonly partition = linkedSignal(() => this.group().partitionId ?? '');

  readonly saveLabel = saveLabel;

  ngOnInit(): void {
    const group = this.group();

    if (group.canManage) {
      this.groupService.memberships(group.id).subscribe({
        next: (x) => this.memberships.set(x ?? []),
        error: (err) => this.error.set(apiErrorMessage(err)),
      });
      this.read(this.projectsApi.getAllProjects(true), this.myProjects);
      this.read(
        this.projectPermissionsApi.getMyProjectPermissions(),
        this.projectClaims,
      );
      this.when(SystemPermission.ManageProjects, () =>
        this.when(SystemPermission.ViewProjects, () =>
          this.read(this.projectsApi.getAllProjects(false), this.allProjects),
        ),
      );
      this.read(this.projectGroupsApi.getProjectGroups(), this.groupNames);
      this.read(this.usersApi.getAllUsers(), this.users);
      this.read(this.groupsApi.getAllGroups(), this.userGroups);
      this.read(this.rolesApi.getAllProjectRoles(), this.roles);
    }

    this.when(SystemPermission.ManageEnvironmentSets, () =>
      this.read(this.setsApi.getEnvironmentSets(), this.sets),
    );
    this.when(SystemPermission.ManageInfrastructure, () =>
      this.read(this.inventoryApi.getInventoryConnections(), this.connections),
    );
    this.when(SystemPermission.ManageVlans, () =>
      this.read(this.vlansApi.getPartitions(), this.partitions),
    );
  }

  saveTab(tab: 'projects' | 'sets' | 'connections'): void {
    if (tab === 'projects') {
      this.saveProjects();
    } else if (tab === 'sets') {
      this.saveSets();
    } else {
      this.saveConnections();
    }
  }

  /** Adds and removes the group's projects, one request each, then reads the group back. */
  saveProjects(): void {
    const id = this.group().id;
    const { add, remove } = this.projectChanges();
    this.save(
      concat(
        ...add.map((x) => this.groupService.addProject(id, x)),
        ...remove.map((x) => this.groupService.removeProject(id, x)),
      ).pipe(toArray()),
    );
  }

  saveSets(): void {
    this.save(
      this.assignmentService.edit(
        groupSetChanges(this.group().id, this.setChanges()),
      ),
    );
  }

  saveConnections(): void {
    const names = new Map(this.connectionItems().map((x) => [x.id, x.name]));
    const { add, remove } = this.connectionChanges();
    this.save(
      this.assignmentService.edit(
        groupConnectionChanges(this.group().id, {
          add: add.map((x) => names.get(x) ?? x),
          remove: remove.map((x) => names.get(x) ?? x),
        }),
      ),
    );
  }

  /** Creates a project in the group: the creator becomes its manager, and it gets the group's memberships and sets. */
  createProject(): void {
    const dialogRef: MatDialogRef<NameDialogComponent> = this.dialog.open(
      NameDialogComponent,
      {
        data: { nameValue: '', showDescription: true, descriptionValue: '' },
        minWidth: '400px',
        maxWidth: '90vw',
      },
    );
    dialogRef.componentInstance.title = `New Project in ${this.group().name}`;
    dialogRef.componentInstance.message = '';
    dialogRef
      .afterClosed()
      .pipe(
        filter((x) => !!x),
        switchMap((x) =>
          this.projectsApi.createProject({
            name: x.nameValue,
            description: x.descriptionValue,
            projectGroupId: this.group().id,
          }),
        ),
        switchMap(() => this.groupService.refresh(this.group().id)),
      )
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });
  }

  /** A new membership gets the API's default role, Member; the members table changes it. */
  addMembership(command: CreateProjectMembershipCommand): void {
    this.membershipRequest(
      this.groupService.addMembership(this.group().id, {
        userId: command.userId,
        groupId: command.groupId,
      }),
    );
  }

  changeRole(command: EditProjectMembershipCommand): void {
    this.membershipRequest(
      this.groupService.editMembership(command.id, command.roleId),
    );
  }

  removeMembership(membershipId: string): void {
    this.membershipRequest(this.groupService.removeMembership(membershipId));
  }

  setPartition(partitionId: string | null): void {
    this.error.set(null);
    this.partition.set(partitionId ?? '');
    this.groupService
      .setPartition(this.group().id, partitionId || null)
      .subscribe({
        error: (err) => {
          this.partition.set(this.group().partitionId ?? '');
          this.error.set(apiErrorMessage(err));
        },
      });
  }

  /** Saves, then reads the group back: its lists reset to what was stored, even after a failure partway. */
  private save(request: Observable<unknown>): void {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    request
      .pipe(
        catchError((err) => {
          this.error.set(apiErrorMessage(err));
          return of(null);
        }),
        switchMap(() => this.groupService.refresh(this.group().id)),
      )
      .subscribe({
        next: () => this.saving.set(false),
        error: () => this.saving.set(false),
      });
  }

  private membershipRequest(
    request: Observable<ProjectGroupMembership[]>,
  ): void {
    this.error.set(null);
    request.subscribe({
      next: (x) => this.memberships.set(x ?? []),
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  private hasPermission(permission: SystemPermission) {
    return toSignal(this.permissionService.hasPermission(permission), {
      initialValue: false,
    });
  }

  private when(permission: SystemPermission, read: () => void): void {
    this.permissionService
      .hasPermission(permission)
      .pipe(
        filter((x) => x),
        take(1),
      )
      .subscribe(() => read());
  }

  private read<T>(
    request: Observable<T[]>,
    target: { set: (value: T[]) => void },
  ): void {
    request
      .pipe(catchError(() => of([] as T[])))
      .subscribe((x) => target.set(x ?? []));
  }
}

function connectionKey(name: string | null | undefined): string {
  return (name ?? '').toLowerCase();
}
