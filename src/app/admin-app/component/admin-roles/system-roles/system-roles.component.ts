/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { SystemPermission, SystemRole } from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import { RoleService } from 'src/app/roles/roles.service.service';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { SystemRolesModel } from './system-roles.models';
import { map, take } from 'rxjs/operators';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { Observable } from 'rxjs';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';

const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-system-roles',
  templateUrl: './system-roles.component.html',
  styleUrls: ['./system-roles.component.scss'],
})
export class SystemRolesComponent implements OnInit, OnDestroy {
  private roleService = inject(RoleService);
  private dialog = inject(MatDialog);
  private confirmService = inject(ConfirmDialogService);
  private permissionService = inject(PermissionService);
  private signalRService = inject(SignalRService);

  public canEdit$ = this.permissionService.hasPermission(
    SystemPermission.ManageRoles
  );

  public allPermission = 'All';

  public permissionMap = SystemRolesModel.SystemPermissions;

  public dataSource = new MatTableDataSource<string>([
    ...[this.allPermission],
    ...Object.values(SystemPermission),
  ]);

  public roles$ = this.roleService.roles$.pipe(
    map((roles) =>
      roles.sort((a, b) => {
        // Sort by 'immutable' property first (false comes after true)
        if (a.immutable !== b.immutable) {
          return a.immutable ? -1 : 1; // Put `true` before `false`
        }
        // If 'immutable' values are the same, sort by 'name' (case-insensitive)
        return a.name.localeCompare(b.name);
      })
    )
  );

  public displayedColumns$ = this.roles$.pipe(
    map((x) => {
      const columnNames = x.map((y) => y.name);
      return ['permissions', ...columnNames];
    })
  );

  ngOnInit(): void {
    this.roleService.getRoles().subscribe();

    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinRolesAdmin();
      })
      .catch((err) => {
        console.log(err);
      });
  }

  ngOnDestroy() {
    this.signalRService.leaveRolesAdmin();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  hasPermission(permission: string, role: SystemRole) {
    if (permission == this.allPermission) {
      return role.allPermissions;
    }

    return role.permissions.some((x) => x == permission);
  }

  setPermission(
    permission: string,
    role: SystemRole,
    event: MatCheckboxChange
  ) {
    if (permission == this.allPermission) {
      role.allPermissions = event.checked;
    } else {
      if (event.checked && !this.hasPermission(permission, role)) {
        role.permissions.push(permission as SystemPermission);
      } else if (!event.checked) {
        role.permissions = role.permissions.filter(
          (x) => x != (permission as SystemPermission)
        );
      }
    }

    this.roleService.editRole(role).subscribe();
  }

  addRole() {
    this.nameDialog('Create New Role?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[this.confirmService.WAS_CANCELLED]) {
          this.roleService.createRole({ name: result[NAME_VALUE] }).subscribe();
        }
      });
  }

  renameRole(role: SystemRole) {
    this.nameDialog('Rename Role?', '', { nameValue: role.name })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[this.confirmService.WAS_CANCELLED]) {
          role.name = result[NAME_VALUE];
          this.roleService.editRole(role).subscribe();
        }
      });
  }

  deleteRole(role: SystemRole) {
    this.confirmService
      .confirmDialog(
        'Delete Role?',
        `Are you sure you want to delete ${role.name}?`,
        {
          buttonTrueText: 'Delete',
          buttonFalseText: 'Cancel',
        }
      )
      .subscribe((result) => {
        if (!result[this.confirmService.WAS_CANCELLED]) {
          this.roleService.deleteRole(role.id).subscribe();
        }
      });
  }

  nameDialog(title: string, message: string, data?: any): Observable<boolean> {
    let dialogRef: MatDialogRef<NameDialogComponent>;
    dialogRef = this.dialog.open(NameDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }
}
