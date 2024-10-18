import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreateGroupMembershipCommand } from 'src/app/generated/caster-api';
import { GroupMembershipService } from 'src/app/groups/group-membership.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { UserQuery } from 'src/app/users/state';

@Component({
  selector: 'cas-admin-groups-detail',
  templateUrl: './admin-groups-detail.component.html',
  styleUrls: ['./admin-groups-detail.component.scss'],
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
    private signalRService: SignalRService
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

  deleteMembership(id: string) {
    console.log(id);
    this.groupMembershipService.deleteMembership(id).subscribe();
  }
}
