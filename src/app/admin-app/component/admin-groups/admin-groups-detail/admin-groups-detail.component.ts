/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateGroupMembershipCommand,
  GroupMembershipRole,
} from 'src/app/generated/caster-api';
import { GroupMembershipService } from 'src/app/groups/group-membership.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { UserQuery } from 'src/app/users/state';

@Component({
    selector: 'cas-admin-groups-detail',
    templateUrl: './admin-groups-detail.component.html',
    styleUrls: ['./admin-groups-detail.component.scss'],
    standalone: false
})
export class AdminGroupsDetailComponent implements OnInit, OnChanges {
  @Input()
  groupId: string;

  @Input()
  canEdit: boolean;

  memberships$ = of([]);

  // All users that are not already members of the project
  nonMembers$ = this.selectUsers(false);
  members$ = this.selectUsers(true);

  constructor(
    private userQuery: UserQuery,
    private groupMembershipService: GroupMembershipService,
    private signalRService: SignalRService,
    private permissionService: PermissionService
  ) {}

  ngOnInit(): void {
    this.groupMembershipService.loadMemberships(this.groupId).subscribe();
    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinGroup(this.groupId);
      })
      .catch((err) => {
        console.log(err);
      });
  }

  ngOnDestroy() {
    this.signalRService.leaveGroup(this.groupId);
  }

  ngOnChanges() {
    this.memberships$ = this.groupMembershipService.selectMemberships(
      this.groupId
    );

    this.nonMembers$ = this.selectUsers(false);
    this.members$ = this.selectUsers(true);
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
      })
    );
  }

  createMembership(command: CreateGroupMembershipCommand) {
    this.groupMembershipService
      .createMembership(this.groupId, command)
      .subscribe();
  }

  deleteMembership(event: { id: string; isCurrentUser: boolean }) {
    this.groupMembershipService.deleteMembership(event.id).subscribe(() => {
      if (event.isCurrentUser) {
        this.refreshOwnGroupPermissions();
      }
    });
  }

  changeRole(event: {
    id: string;
    role: GroupMembershipRole;
    isCurrentUser: boolean;
  }) {
    this.groupMembershipService
      .editMembership(event.id, { role: event.role })
      .subscribe(() => {
        if (event.isCurrentUser) {
          this.refreshOwnGroupPermissions();
        }
      });
  }

  // A self role-change or self-removal alters the current user's own group claims;
  // force a reload so per-group controls and admin visibility recompute live.
  private refreshOwnGroupPermissions() {
    this.permissionService.loadGroupPermissions(undefined, true).subscribe();
  }
}
