/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, inject, OnInit } from '@angular/core';
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
import { ProjectPermission, ProjectRole } from 'src/app/generated/caster-api';
import { ProjectRolesModel } from './project-roles.models';
import { map } from 'rxjs/operators';
import { ProjectRoleService } from 'src/app/project/state/project-role.service';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatCheckbox } from '@angular/material/checkbox';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-project-roles',
  templateUrl: './project-roles.component.html',
  styleUrls: ['./project-roles.component.scss'],
  imports: [
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatIconButton,
    MatTooltip,
    MatIcon,
    MatCheckbox,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    AsyncPipe,
  ],
})
export class ProjectRolesComponent implements OnInit {
  private projectRoleService = inject(ProjectRoleService);

  public allPermission = 'All';

  public permissionMap = ProjectRolesModel.ProjectPermissions;

  public dataSource = new MatTableDataSource<string>([
    ...[this.allPermission],
    ...Object.values(ProjectPermission),
  ]);

  public roles$ = this.projectRoleService.projectRoles$.pipe(
    map((roles) =>
      roles.sort((a, b) => {
        return a.name.localeCompare(b.name);
      }),
    ),
  );

  public displayedColumns$ = this.roles$.pipe(
    map((x) => {
      const columnNames = x.map((y) => y.name);
      return ['permissions', ...columnNames];
    }),
  );

  ngOnInit(): void {
    this.projectRoleService.loadRoles().subscribe();
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  hasPermission(permission: string, role: ProjectRole) {
    if (permission == this.allPermission) {
      return role.allPermissions;
    }

    return role.permissions.some((x) => x == permission);
  }
}
