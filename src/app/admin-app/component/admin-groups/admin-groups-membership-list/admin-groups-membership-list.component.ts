/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
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
export class AdminGroupsMembershipListComponent
  implements OnInit, OnChanges, AfterViewInit
{
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

  filterString = '';

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(public snackBar: MatSnackBar) {}

  ngOnInit(): void {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnChanges() {
    this.dataSource.data = this.users;

    this.displayedColumns = this.viewColumns.concat(
      this.canEdit ? this.editColumns : []
    );
  }

  add(id: string) {
    this.createMembership.emit({ userId: id });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  clearFilter() {
    this.filterString = '';
    this.dataSource.filter = this.filterString;
  }
}
