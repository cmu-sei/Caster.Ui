import { Component, Input, OnInit } from '@angular/core';
import { combineLatest, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ProjectService } from 'src/app/project/state';
import { ProjectMembershipService } from 'src/app/project/state/project-membership.service';
import { ProjectRoleService } from 'src/app/project/state/project-role.service';
import { UserQuery, UserService } from 'src/app/users/state';
import { EditProjectMembershipCommand } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-project-memberships',
  templateUrl: './project-memberships.component.html',
  styleUrls: ['./project-memberships.component.scss'],
})
export class ProjectMembershipsComponent implements OnInit {
  @Input()
  projectId: string;

  memberships$ = this.projectMembershipService.projectMemberships$;
  roles$ = this.projectRolesService.projectRoles$;

  // All users that are not already members of the project
  nonMembers$ = this.selectUsers(false);
  members$ = this.selectUsers(true);

  constructor(
    private projectService: ProjectService,
    private projectMembershipService: ProjectMembershipService,
    private projectRolesService: ProjectRoleService,
    private userService: UserService,
    private userQuery: UserQuery
  ) {}

  ngOnInit(): void {
    forkJoin([
      this.projectService.loadProject(this.projectId),
      this.projectMembershipService.loadMemberships(this.projectId),
      this.userService.load(),
      this.projectRolesService.loadRoles(),
    ]).subscribe();
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

  createMembership(userId: string) {
    this.projectMembershipService
      .createMembership(this.projectId, userId)
      .subscribe();
  }

  deleteMembership(userId: string) {
    this.projectMembershipService
      .deleteMembership(this.projectId, userId)
      .subscribe();
  }

  editMembership(command: EditProjectMembershipCommand) {
    this.projectMembershipService
      .editMembership(this.projectId, command)
      .subscribe();
  }
}
