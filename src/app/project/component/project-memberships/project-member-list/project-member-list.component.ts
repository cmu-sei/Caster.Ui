import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { MatTableDataSource } from '@angular/material/table';
import {
  EditProjectMembershipCommand,
  Group,
  ProjectMembership,
  ProjectRole,
  User,
} from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-project-member-list',
  templateUrl: './project-member-list.component.html',
  styleUrls: ['./project-member-list.component.scss'],
})
export class ProjectMemberListComponent implements OnInit {
  @Input()
  memberships: ProjectMembership[];

  @Input()
  users: User[];

  @Input()
  groups: Group[];

  @Input()
  roles: ProjectRole[];

  @Input()
  canEdit: boolean;

  @Output()
  deleteMembership = new EventEmitter<string>();

  @Output()
  editMembership = new EventEmitter<EditProjectMembershipCommand>();

  viewColumns = ['name', 'type', 'role'];
  editColumns = ['actions'];
  displayedColumns = this.viewColumns;
  dataSource = new MatTableDataSource<ProjectMembershipModel>();

  constructor() {}

  ngOnInit(): void {}

  ngOnChanges() {
    this.buildModel();

    this.displayedColumns = this.viewColumns.concat(
      this.canEdit ? this.editColumns : []
    );
  }

  buildModel() {
    console.log(this.memberships);
    console.log(this.roles);
    this.dataSource.data = this.memberships
      .map((x) => {
        const user = this.users.find((u) => u.id == x.userId);
        const group = this.groups.find((g) => g.id == x.groupId);
        const role = this.roles.find((r) => r.id == x.roleId);

        let membership = {
          membership: x,
          role: role,
        } as ProjectMembershipModel;

        if (user != null) {
          membership.user = user;
          membership.name = user.name;
          membership.type = 'User';
        } else if (group != null) {
          membership.group = group;
          membership.name = group.name;
          membership.type = 'Group';
        }

        return membership;
      })
      .filter((x) => x);
  }

  delete(id: string) {
    this.deleteMembership.emit(id);
  }

  updateRole(id: string, event: MatSelectChange) {
    this.editMembership.emit({
      id: id,
      roleId: event.value == '' ? null : event.value,
    });
  }

  trackById(item) {
    return item.id;
  }
}

export interface ProjectMembershipModel {
  membership: ProjectMembership;
  user: User;
  group: Group;
  role: ProjectRole;
  name: string;
  type: string;
}
