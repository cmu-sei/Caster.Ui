import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { MatTableDataSource } from '@angular/material/table';
import {
  EditProjectMembershipCommand,
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
  roles: ProjectRole[];

  @Output()
  deleteMembership = new EventEmitter<string>();

  @Output()
  editMembership = new EventEmitter<EditProjectMembershipCommand>();

  displayedColumns: string[] = ['name', 'role', 'actions'];
  dataSource = new MatTableDataSource<ProjectMembershipModel>();

  constructor() {}

  ngOnInit(): void {}

  ngOnChanges() {
    this.buildModel();
  }

  buildModel() {
    console.log(this.memberships);
    console.log(this.roles);
    this.dataSource.data = this.memberships
      .map((x) => {
        const user = this.users.find((u) => u.id == x.userId);
        const role = this.roles.find((r) => r.id == x.roleId);

        if (user != null) {
          return {
            membership: x,
            user: user,
            role: role,
          } as ProjectMembershipModel;
        }
      })
      .filter((x) => x);
  }

  deleteUser(userId: string) {
    this.deleteMembership.emit(userId);
  }

  updateRole(userId: string, event: MatSelectChange) {
    this.editMembership.emit({
      userId: userId,
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
  role: ProjectRole;
}
