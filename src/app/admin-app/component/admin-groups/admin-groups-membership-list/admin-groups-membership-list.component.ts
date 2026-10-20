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
  inject,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import {
  CreateGroupMembershipCommand,
  Group,
  GroupMembershipRole,
  User,
} from 'src/app/generated/caster-api';
import { MatToolbar, MatToolbarRow } from '@angular/material/toolbar';
import {
  MatFormField,
  MatLabel,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { ClipboardModule } from 'ngx-clipboard';
import { CurrentUserBadgeComponent } from '../../../../shared/components/current-user-badge/current-user-badge.component';

@Component({
  selector: 'cas-admin-groups-membership-list',
  templateUrl: './admin-groups-membership-list.component.html',
  styleUrls: ['./admin-groups-membership-list.component.scss'],
  imports: [
    MatToolbar,
    MatToolbarRow,
    MatFormField,
    MatLabel,
    MatIcon,
    MatPrefix,
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
    CurrentUserBadgeComponent,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
  ],
})
export class AdminGroupsMembershipListComponent
  implements OnInit, OnChanges, AfterViewInit
{
  snackBar = inject(MatSnackBar);

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

  ngOnInit(): void {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnChanges() {
    this.dataSource.data = this.users;

    this.displayedColumns = this.viewColumns.concat(
      this.canEdit ? this.editColumns : [],
    );
  }

  add(id: string, role: GroupMembershipRole = GroupMembershipRole.Member) {
    this.createMembership.emit({ userId: id, role });
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
