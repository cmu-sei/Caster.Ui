import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { GroupMembership, User } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-admin-groups-member-list',
  templateUrl: './admin-groups-member-list.component.html',
  styleUrls: ['./admin-groups-member-list.component.scss'],
})
export class AdminGroupsMemberListComponent implements OnInit {
  @Input()
  memberships: GroupMembership[];

  @Input()
  users: User[];

  @Output()
  deleteMembership = new EventEmitter<string>();

  displayedColumns: string[] = ['name', 'actions'];
  dataSource = new MatTableDataSource<GroupMembershipModel>();

  constructor() {}

  ngOnInit(): void {}

  ngOnChanges() {
    console.log(this.users);
    this.buildModel();
  }

  buildModel() {
    this.dataSource.data = this.memberships
      .map((x) => {
        const user = this.users.find((u) => u.id == x.userId);

        return {
          membership: x,
          user: user,
          name: user?.name,
        } as GroupMembershipModel;
      })
      .filter((x) => x);
  }

  delete(id: string) {
    this.deleteMembership.emit(id);
  }

  trackById(item) {
    return item.id;
  }
}

export interface GroupMembershipModel {
  membership: GroupMembership;
  user: User;
  name: string;
}
