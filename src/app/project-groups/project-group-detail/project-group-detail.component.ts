// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import {
  EnvironmentSet,
  EnvironmentSetsService,
  Group,
  GroupsService,
  InventoryConnection,
  InventoryService,
  Partition,
  Project,
  ProjectGroup,
  ProjectGroupItem,
  ProjectGroupMembership,
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
import { ProjectGroupService } from '../project-group.service';

/**
 * One project group: its projects, memberships, and what it gives them. Each part is editable by
 * those who may: memberships and projects by the group's managers and ManageProjectGroups, sets by
 * ManageEnvironmentSets, connections by ManageInfrastructure, the partition by ManageVLANs. Hosts
 * are given to a group through the Hosts API.
 */
@Component({
  selector: 'cas-project-group-detail',
  templateUrl: './project-group-detail.component.html',
  styleUrls: ['./project-group-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  ],
})
export class ProjectGroupDetailComponent implements OnInit {
  private groupService = inject(ProjectGroupService);
  private permissionService = inject(PermissionService);
  private confirmService = inject(CrucibleDialogService);
  private projectsApi = inject(ProjectsService);
  private usersApi = inject(UsersService);
  private groupsApi = inject(GroupsService);
  private rolesApi = inject(ProjectRolesService);
  private setsApi = inject(EnvironmentSetsService);
  private inventoryApi = inject(InventoryService);
  private vlansApi = inject(VlansService);
  private dialog = inject(MatDialog);

  readonly group = input.required<ProjectGroup>();

  readonly canManageSets$ = this.permissionService.hasPermission(
    SystemPermission.ManageEnvironmentSets,
  );
  readonly canManageConnections$ = this.permissionService.hasPermission(
    SystemPermission.ManageInfrastructure,
  );
  readonly canCreateProjects$ = this.permissionService.hasPermission(
    SystemPermission.CreateProjects,
  );
  readonly canManageVlans$ = this.permissionService.hasPermission(
    SystemPermission.ManageVlans,
  );

  readonly memberships = signal<ProjectGroupMembership[]>([]);
  readonly error = signal<string | null>(null);

  /** The projects the user can manage, which they can add (the API checks again). */
  projects$: Observable<Project[]> = of([]);
  users$: Observable<User[]> = of([]);
  userGroups$: Observable<Group[]> = of([]);
  roles$: Observable<ProjectRole[]> = of([]);
  sets$: Observable<EnvironmentSet[]> = of([]);
  connections$: Observable<InventoryConnection[]> = of([]);
  partitions$: Observable<Partition[]> = of([]);

  selectedProject: string | null = null;
  selectedUser: string | null = null;
  selectedUserGroup: string | null = null;
  selectedRole: string | null = null;
  selectedSet: string | null = null;
  selectedConnection: string | null = null;

  ngOnInit(): void {
    const group = this.group();

    if (group.canManage) {
      this.groupService.memberships(group.id).subscribe({
        next: (x) => this.memberships.set(x ?? []),
        error: (err) => this.error.set(apiErrorMessage(err)),
      });
      this.projects$ = this.projectsApi
        .getAllProjects(true)
        .pipe(catchError(() => of([])));
      this.users$ = this.usersApi.getAllUsers().pipe(catchError(() => of([])));
      this.userGroups$ = this.groupsApi
        .getAllGroups()
        .pipe(catchError(() => of([])));
      this.roles$ = this.rolesApi
        .getAllProjectRoles()
        .pipe(catchError(() => of([])));
    }

    this.sets$ = this.when(this.canManageSets$, () =>
      this.setsApi.getEnvironmentSets(),
    );
    this.connections$ = this.when(this.canManageConnections$, () =>
      this.inventoryApi.getInventoryConnections(),
    );
    this.partitions$ = this.when(this.canManageVlans$, () =>
      this.vlansApi.getPartitions(),
    );
  }

  unassigned<T extends { id?: string }>(
    all: T[] | null,
    assigned: ProjectGroupItem[] | null | undefined,
  ): T[] {
    const ids = new Set((assigned ?? []).map((x) => x.id));
    return (all ?? []).filter((x) => !ids.has(x.id));
  }

  unassignedConnections(
    all: InventoryConnection[] | null,
  ): InventoryConnection[] {
    const names = new Set(
      (this.group().inventoryConnections ?? []).map((x) => x.toLowerCase()),
    );
    return (all ?? []).filter((x) => !names.has((x.name ?? '').toLowerCase()));
  }

  addProject(): void {
    this.run(
      this.groupService.addProject(this.group().id, this.selectedProject),
      () => (this.selectedProject = null),
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
        switchMap(() => this.groupService.load()),
      )
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });
  }

  removeProject(project: ProjectGroupItem): void {
    this.confirm(
      `Take ${project.name} out of ${this.group().name}? It keeps its own memberships and sets, and loses the group's.`,
      () => this.groupService.removeProject(this.group().id, project.id),
    );
  }

  addMembership(): void {
    const command = {
      userId: this.selectedUser ?? undefined,
      groupId: this.selectedUser
        ? undefined
        : (this.selectedUserGroup ?? undefined),
      roleId: this.selectedRole ?? undefined,
    };
    this.run(this.groupService.addMembership(this.group().id, command), (x) => {
      this.memberships.set(x ?? []);
      this.selectedUser = this.selectedUserGroup = this.selectedRole = null;
    });
  }

  changeRole(membership: ProjectGroupMembership, roleId: string): void {
    this.run(this.groupService.editMembership(membership.id, roleId), (x) =>
      this.memberships.set(x ?? []),
    );
  }

  removeMembership(membership: ProjectGroupMembership): void {
    this.confirm(
      `Remove ${membership.userName ?? membership.groupName} from ${this.group().name}?`,
      () =>
        this.groupService.removeMembership(membership.id).pipe(
          map((x) => {
            this.memberships.set(x ?? []);
            return x;
          }),
        ),
    );
  }

  assignSet(): void {
    this.run(
      this.groupService.assignSet(this.group().id, this.selectedSet),
      () => (this.selectedSet = null),
    );
  }

  unassignSet(set: ProjectGroupItem): void {
    this.confirm(
      `Take ${set.name} from ${this.group().name}? Its projects' next runs won't get it unless it's assigned to them directly.`,
      () => this.groupService.unassignSet(this.group().id, set.id),
    );
  }

  assignConnection(): void {
    this.run(
      this.groupService.assignConnection(
        this.group().id,
        this.selectedConnection,
      ),
      () => (this.selectedConnection = null),
    );
  }

  unassignConnection(name: string): void {
    this.confirm(
      `Stop showing ${name}'s inventory to ${this.group().name}'s projects?`,
      () => this.groupService.unassignConnection(this.group().id, name),
    );
  }

  setPartition(partitionId: string | null): void {
    this.run(
      this.groupService.setPartition(this.group().id, partitionId || null),
      () => undefined,
    );
  }

  private when<T>(
    allowed$: Observable<boolean>,
    read: () => Observable<T[]>,
  ): Observable<T[]> {
    return allowed$.pipe(
      take(1),
      switchMap((allowed) =>
        allowed ? read().pipe(catchError(() => of([] as T[]))) : of([] as T[]),
      ),
    );
  }

  private run<T>(request: Observable<T>, done: (result: T) => void): void {
    this.error.set(null);
    request.subscribe({
      next: (x) => done(x),
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  private confirm<T>(message: string, request: () => Observable<T>): void {
    this.confirmService
      .confirm({ title: 'Confirm', message, confirmText: 'Remove' })
      .afterClosed()
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => request()),
      )
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });
  }
}
