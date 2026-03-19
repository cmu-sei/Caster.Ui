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
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ConfirmDialogComponent } from 'src/app/sei-cwd-common/confirm-dialog/components/confirm-dialog.component';
import { User } from '../../../../generated/caster-api';
import { Observable } from 'rxjs';
import { RoleService } from 'src/app/roles/roles.service.service';
import { MatSelectChange } from '@angular/material/select';
import { UserService } from 'src/app/users/state';

const WAS_CANCELLED = 'wasCancelled';

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
  public savedFilterString = '';
  public dataSource = new MatTableDataSource<User>(new Array<User>());
  public newUser: User = {};

  public addingNewUser: boolean;
  roles$ = this.roleService.roles$;

  @Input() users: User[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() create: EventEmitter<User> = new EventEmitter<User>();
  @Output() delete: EventEmitter<string> = new EventEmitter<string>();
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
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

  addNewUser(addUser: boolean) {
    if (addUser) {
      const user = {
        id: this.newUser.id,
        name: this.newUser.name,
      };
      this.savedFilterString = this.filterString;
      this.create.emit(user);
    }
    this.newUser = {};
    this.addingNewUser = false;
  }

  deleteUser(user: User) {
    this.confirmDialog('Delete ' + user.name + '?', user.id, {
      buttonTrueText: 'Delete',
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.delete.emit(user.id);
      }
    });
  }

  confirmDialog(
    title: string,
    message: string,
    data?: any
  ): Observable<boolean> {
    let dialogRef: MatDialogRef<ConfirmDialogComponent>;
    dialogRef = this.dialog.open(ConfirmDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
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
