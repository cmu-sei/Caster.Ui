// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
} from '@angular/material/table';
import { User } from '../../../../generated/caster-api';
import { RoleService } from 'src/app/roles/roles.service.service';
import {
  MatSelectChange,
  MatSelect,
  MatOption,
} from '@angular/material/select';
import { UserService } from 'src/app/users/state';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { take } from 'rxjs/operators';
import { AddUserDialogComponent } from '../add-user-dialog/add-user-dialog.component';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { ClipboardModule } from 'ngx-clipboard';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { AsyncPipe } from '@angular/common';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'cas-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
  imports: [
    MatIcon,
    MatFormField,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatPaginator,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatSortHeader,
    MatCellDef,
    MatCell,
    ClipboardModule,
    MatSelect,
    MatOption,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatCard,
    MatProgressSpinner,
    AsyncPipe,
  ],
})
export class UserListComponent implements OnInit, OnChanges {
  private confirmService = inject(CrucibleDialogService);
  private dialog = inject(MatDialog);
  private roleService = inject(RoleService);
  private userService = inject(UserService);

  public displayedColumns: string[] = ['id', 'name', 'roleId'];
  public filterString = '';
  public dataSource = new MatTableDataSource<User>(new Array<User>());
  roles$ = this.roleService.roles$;

  readonly users = input<User[]>(undefined);
  readonly isLoading = input<boolean>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly create = output<User>();
  readonly delete = output<string>();
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  ngOnInit() {
    const paginator = this.paginator();
    if (paginator) {
      this.dataSource.paginator = paginator;
    }
    this.dataSource.sort = this.sort();
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
        title: 'Delete User',
        message: `Are you sure that you want to delete ${user.name}?`,
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
