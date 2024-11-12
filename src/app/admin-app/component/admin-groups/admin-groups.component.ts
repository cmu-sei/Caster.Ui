// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Group } from 'src/app/generated/caster-api';
import { GroupService } from 'src/app/groups/group.service';
import { ConfirmDialogComponent } from 'src/app/sei-cwd-common/confirm-dialog/components/confirm-dialog.component';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { UserService } from 'src/app/users/state';

const WAS_CANCELLED = 'wasCancelled';
const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-admin-groups',
  templateUrl: './admin-groups.component.html',
  styleUrls: ['./admin-groups.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminGroupsComponent implements OnInit {
  //@ViewChild('createInput', { static: true }) createInput: HTMLInputElement;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  filterString = '';
  displayedColumns: string[] = ['name'];
  dataSource: MatTableDataSource<Group> = new MatTableDataSource();

  constructor(
    private groupsService: GroupService,
    private usersService: UserService,
    private dialog: MatDialog
  ) {}

  dataSource$ = this.groupsService.groups$.pipe(
    map((x) => {
      this.dataSource.data = x;
      return this.dataSource;
    })
  );

  ngOnInit() {
    forkJoin([this.groupsService.load(), this.usersService.load()]).subscribe();
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  clearFilter() {
    this.applyFilter('');
  }

  createGroup() {
    this.nameDialog('Create New Group?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (!result[WAS_CANCELLED]) {
          this.groupsService.create({ name: result[NAME_VALUE] }).subscribe();
        }
      }
    );
  }

  updateGroup(group: Group) {
    this.nameDialog('Rename ' + group.name, '', {
      nameValue: group.name,
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.groupsService
          .edit({ id: group.id, name: result[NAME_VALUE] })
          .subscribe();
      }
    });
  }

  deleteGroup(group: Group) {
    this.confirmDialog('Delete Group?', 'Delete Group ' + group.name + '?', {
      buttonTrueText: 'Delete',
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.groupsService.delete(group.id).subscribe();
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

  nameDialog(title: string, message: string, data?: any): Observable<boolean> {
    let dialogRef: MatDialogRef<NameDialogComponent>;
    dialogRef = this.dialog.open(NameDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }
}
