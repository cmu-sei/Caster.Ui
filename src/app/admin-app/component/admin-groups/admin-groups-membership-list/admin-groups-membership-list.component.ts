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

  @Output()
  createMembership = new EventEmitter<CreateGroupMembershipCommand>();

  displayedColumns: string[] = ['name', 'actions'];
  dataSource = new MatTableDataSource<User>();

  constructor(public snackBar: MatSnackBar) {}

  ngOnInit(): void {}

  ngOnChanges() {
    this.dataSource.data = this.users;
  }

  add(id: string) {
    this.createMembership.emit({ userId: id });
  }
}
