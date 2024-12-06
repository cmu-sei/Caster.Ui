import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import {
  CreateGroupMembershipCommand,
  Group,
  User,
} from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-admin-groups-membership-list',
  templateUrl: './admin-groups-membership-list.component.html',
  styleUrls: ['./admin-groups-membership-list.component.scss'],
})
export class AdminGroupsMembershipListComponent implements OnInit {
  @Input()
  users: User[];

  @Input()
  canEdit: boolean;

  @Output()
  createMembership = new EventEmitter<CreateGroupMembershipCommand>();

  viewColumns = ['name'];
  editColumns = ['actions'];
  displayedColumns = this.viewColumns;
  dataSource = new MatTableDataSource<User>();

  constructor(public snackBar: MatSnackBar) {}

  ngOnInit(): void {}

  ngOnChanges() {
    this.dataSource.data = this.users;

    this.displayedColumns = this.viewColumns.concat(
      this.canEdit ? this.editColumns : []
    );
  }

  add(id: string) {
    this.createMembership.emit({ userId: id });
  }
}
