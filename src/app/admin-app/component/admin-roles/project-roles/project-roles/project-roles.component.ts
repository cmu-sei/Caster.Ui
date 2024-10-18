import { Component, inject, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { ProjectPermission, ProjectRole } from 'src/app/generated/caster-api';
import { ProjectRolesModel } from './project-roles.models';
import { map } from 'rxjs/operators';
import { ProjectRoleService } from 'src/app/project/state/project-role.service';

@Component({
  selector: 'cas-project-roles',
  templateUrl: './project-roles.component.html',
  styleUrls: ['./project-roles.component.scss'],
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
