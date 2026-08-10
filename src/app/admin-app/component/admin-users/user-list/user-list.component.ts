// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  EventEmitter,
  OnInit,
  ViewChild,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { User } from '../../../../generated/caster-api';
import { RoleService } from 'src/app/roles/roles.service.service';
import { MatSelectChange } from '@angular/material/select';
import { UserService } from 'src/app/users/state';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { take } from 'rxjs/operators';
import { AddUserDialogComponent } from '../add-user-dialog/add-user-dialog.component';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'cas-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
  standalone: false,
})
export class UserListComponent implements OnInit, OnChanges {
  public displayedColumns: string[] = ['id', 'name', 'roleId'];
  public filterString = '';
  public dataSource = new MatTableDataSource<User>(new Array<User>());
  roles$ = this.roleService.roles$;

  @Input() users: User[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() create: EventEmitter<User> = new EventEmitter<User>();
  @Output() delete: EventEmitter<string> = new EventEmitter<string>();
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private confirmService: CrucibleDialogService,
    private dialog: MatDialog,
    private roleService: RoleService,
    private userService: UserService
  ) {}

  ngOnInit() {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    this.dataSource.sort = this.sort;
    this.roleService.getRoles().subscribe();
    this.filterAndSort(this.filterString);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!!changes.users && !!changes.users.currentValue) {
      this.dataSource.data = changes.users.currentValue;
      this.filterAndSort(this.filterString);
    }
  }

  filterAndSort(filterValue: string) {
    this.dataSource.filter = filterValue;
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue.toLowerCase();
    this.filterAndSort(this.filterString);
  }

  clearFilter() {
    this.applyFilter('');
  }

  addNewUser() {
    this.dialog
      .open(AddUserDialogComponent, { minWidth: '400px', maxWidth: '90vw' })
      .afterClosed()
      .pipe(take(1))
      .subscribe((user: User) => {
        if (user) {
          this.create.emit(user);
        }
      });
  }

  deleteUser(user: User) {
    this.confirmService
      .confirm({
        title: 'Delete ' + user.name + '?',
        message: user.id,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.delete.emit(user.id);
        }
      });
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  updateRole(user: User, event: MatSelectChange) {
    this.userService.editUser({
      ...user,
      roleId: event.value === '' ? null : event.value,
    });
  }
}
