import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { SystemPermissions, SystemRole } from 'src/app/generated/caster-api';
import { RolesService } from 'src/app/roles/roles.service.service';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';

const WAS_CANCELLED = 'wasCancelled';
const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-admin-roles',
  templateUrl: './admin-roles.component.html',
  styleUrls: ['./admin-roles.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRolesComponent implements OnInit {
  private roleService = inject(RolesService);
  private dialog = inject(MatDialog);
  private confirmService = inject(ConfirmDialogService);

  public allPermission = 'All';

  public dataSource = new MatTableDataSource<string>([
    ...[this.allPermission],
    ...Object.values(SystemPermissions),
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
  }

  trackById(item) {
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
        role.permissions.push(permission as SystemPermissions);
      } else if (!event.checked) {
        role.permissions = role.permissions.filter(
          (x) => x != (permission as SystemPermissions)
        );
      }
    }

    this.roleService.editRole(role).subscribe();
  }

  addRole() {
    this.nameDialog('Create New Role?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[WAS_CANCELLED]) {
          this.roleService.createRole({ name: result[NAME_VALUE] }).subscribe();
        }
      });
  }

  renameRole(role: SystemRole) {
    this.nameDialog('Rename Role?', '', { nameValue: role.name })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[WAS_CANCELLED]) {
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
        if (!result[WAS_CANCELLED]) {
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
