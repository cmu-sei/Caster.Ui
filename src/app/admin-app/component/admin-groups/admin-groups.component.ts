// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Group, SystemPermission } from 'src/app/generated/caster-api';
import { GroupService } from 'src/app/groups/group.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { UserService } from 'src/app/users/state';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { AdminGroupsDetailComponent } from './admin-groups-detail/admin-groups-detail.component';
import { AsyncPipe } from '@angular/common';

const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-admin-groups',
  templateUrl: './admin-groups.component.html',
  styleUrls: ['./admin-groups.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ),
    ]),
  ],
  imports: [
    MatIcon,
    MatFormField,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatTooltip,
    MatCellDef,
    MatCell,
    MatSortHeader,
    AdminGroupsDetailComponent,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    AsyncPipe,
  ],
})
export class AdminGroupsComponent implements OnInit, AfterViewInit {
  private groupsService = inject(GroupService);
  private usersService = inject(UserService);
  private dialog = inject(MatDialog);
  private permissionService = inject(PermissionService);
  private confirmService = inject(CrucibleDialogService);

  @ViewChild(MatSort) sort: MatSort;

  filterString = '';
  displayedColumns: string[] = ['actions', 'name'];
  dataSource: MatTableDataSource<Group> = new MatTableDataSource();
  expandedGroupId: string | null = null;

  dataSource$ = this.groupsService.groups$.pipe(
    map((x) => {
      this.dataSource.data = x;
      return this.dataSource;
    }),
  );

  canEdit$ = this.permissionService.hasPermission(
    SystemPermission.ManageGroups,
  );

  private canManageGroupCache = new Map<string, Observable<boolean>>();
  private canEditGroupCache = new Map<string, Observable<boolean>>();

  ngOnInit() {
    forkJoin([
      this.groupsService.load(),
      this.usersService.load(),
      this.permissionService.loadGroupPermissions(),
    ]).subscribe();
  }

  canManageGroup$(groupId: string): Observable<boolean> {
    let obs = this.canManageGroupCache.get(groupId);
    if (!obs) {
      obs = this.permissionService.canManageGroup(groupId);
      this.canManageGroupCache.set(groupId, obs);
    }
    return obs;
  }

  canEditGroup$(groupId: string): Observable<boolean> {
    let obs = this.canEditGroupCache.get(groupId);
    if (!obs) {
      obs = this.permissionService.canEditGroup(groupId);
      this.canEditGroupCache.set(groupId, obs);
    }
    return obs;
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  clearFilter() {
    this.applyFilter('');
  }

  toggleExpand(groupId: string) {
    this.expandedGroupId = this.expandedGroupId === groupId ? null : groupId;
  }

  createGroup() {
    this.nameDialog('Create New Group?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (result) {
          this.groupsService.create({ name: result[NAME_VALUE] }).subscribe();
        }
      },
    );
  }

  updateGroup(group: Group) {
    this.nameDialog('Rename ' + group.name, '', {
      nameValue: group.name,
    }).subscribe((result) => {
      if (result) {
        this.groupsService
          .edit({ id: group.id, name: result[NAME_VALUE] })
          .subscribe();
      }
    });
  }

  deleteGroup(group: Group) {
    this.confirmService
      .confirm({
        title: 'Delete Group?',
        message: 'Delete Group ' + group.name + '?',
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.groupsService.delete(group.id).subscribe();
        }
      });
  }

  nameDialog(title: string, message: string, data?: any): Observable<any> {
    let dialogRef: MatDialogRef<NameDialogComponent>;
    dialogRef = this.dialog.open(NameDialogComponent, {
      data: data || {},
      minWidth: '400px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }
}
