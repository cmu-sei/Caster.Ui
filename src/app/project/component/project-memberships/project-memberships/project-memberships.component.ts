/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  EventEmitter,
  OnChanges,
  OnInit,
  Output,
  inject,
  input,
} from '@angular/core';
import { combineLatest, forkJoin, Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { ProjectQuery, ProjectService } from 'src/app/project/state';
import { ProjectMembershipService } from 'src/app/project/state/project-membership.service';
import { ProjectRoleService } from 'src/app/project/state/project-role.service';
import { UserQuery, UserService } from 'src/app/users/state';
import {
  CreateProjectMembershipCommand,
  EditProjectMembershipCommand,
  Project,
} from 'src/app/generated/caster-api';
import { GroupService } from 'src/app/groups/group.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { ProjectMembershipListComponent } from '../project-membership-list/project-membership-list.component';
import { ProjectMemberListComponent } from '../project-member-list/project-member-list.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-project-memberships',
  templateUrl: './project-memberships.component.html',
  styleUrls: ['./project-memberships.component.scss'],
  imports: [
    MatIconButton,
    MatTooltip,
    MatIcon,
    ProjectMembershipListComponent,
    ProjectMemberListComponent,
    AsyncPipe,
  ],
})
export class ProjectMembershipsComponent implements OnInit, OnChanges {
  private projectService = inject(ProjectService);
  private projectQuery = inject(ProjectQuery);
  private projectMembershipService = inject(ProjectMembershipService);
  private projectRolesService = inject(ProjectRoleService);
  private userService = inject(UserService);
  private userQuery = inject(UserQuery);
  private groupService = inject(GroupService);
  private permissionService = inject(PermissionService);
  private signalRService = inject(SignalRService);

  readonly projectId = input<string>(undefined);

  readonly embedded = input(false);

  // Shows the return affordance when this view is not embedded in a parent
  // view, e.g. the standalone /projects/:id/memberships page.
  readonly showReturnButton = input(false);

  readonly returnLabel = input('Return');

  @Output()
  goBack = new EventEmitter();

  project$: Observable<Project>;

  memberships$ = this.projectMembershipService.projectMemberships$;
  roles$ = this.projectRolesService.projectRoles$;

  // All users that are not already members of the project
  nonMembers$ = this.selectUsers(false);
  members$ = this.selectUsers(true);

  groupNonMembers$ = this.selectGroups(false);
  groupMembers$ = this.selectGroups(true);

  canEdit$: Observable<boolean>;

  ngOnInit(): void {
    forkJoin([
      this.projectService.loadProject(this.projectId()),
      this.projectMembershipService.loadMemberships(this.projectId()),
      this.userService.load(),
      this.projectRolesService.loadRoles(),
      this.groupService.load(),
    ]).subscribe();

    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinProjectAdmin(this.projectId());
      })
      .catch((err) => {
        console.log(err);
      });
  }

  ngOnDestroy() {
    this.signalRService.leaveProjectAdmin(this.projectId());
  }

  ngOnChanges() {
    this.project$ = this.projectQuery.selectEntity(this.projectId()).pipe(
      filter((x) => x != null),
      tap((x) => (this.canEdit$ = this.permissionService.canEditProject(x.id))),
    );
  }

  selectUsers(members: boolean) {
    return combineLatest([this.userQuery.selectAll(), this.memberships$]).pipe(
      map(([users, memberships]) => {
        return users.filter((user) => {
          if (members) {
            return (
              memberships.length > 0 &&
              memberships.some((y) => y.userId == user.id)
            );
          } else {
            return (
              memberships.length === 0 ||
              !memberships.some((y) => y.userId == user.id)
            );
          }
        });
      }),
    );
  }

  selectGroups(members: boolean) {
    return combineLatest([this.groupService.groups$, this.memberships$]).pipe(
      map(([groups, memberships]) => {
        return groups.filter((group) => {
          if (members) {
            return (
              memberships.length > 0 &&
              memberships.some((y) => y.groupId == group.id)
            );
          } else {
            return (
              memberships.length === 0 ||
              !memberships.some((y) => y.groupId == group.id)
            );
          }
        });
      }),
    );
  }

  createMembership(command: CreateProjectMembershipCommand) {
    this.projectMembershipService
      .createMembership(this.projectId(), command)
      .subscribe();
  }

  deleteMembership(id: string) {
    this.projectMembershipService.deleteMembership(id).subscribe();
  }

  editMembership(command: EditProjectMembershipCommand) {
    this.projectMembershipService.editMembership(command).subscribe();
  }
}
