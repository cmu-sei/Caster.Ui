// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  ProjectPermission,
  ProjectPermissionsClaim,
  ProjectPermissionsService,
  SystemPermission,
  SystemPermissionsService,
} from '../generated/caster-api';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private permissionsSubject = new BehaviorSubject<SystemPermission[]>([]);
  public permissions$ = this.permissionsSubject.asObservable();

  private projectPermissionsSubject = new BehaviorSubject<
    ProjectPermissionsClaim[]
  >([]);
  public projectPermissions$ = this.projectPermissionsSubject.asObservable();

  constructor(
    private permissionsService: SystemPermissionsService,
    private projectPermissionsService: ProjectPermissionsService
  ) {}

  load(): Observable<SystemPermission[]> {
    return this.permissionsService
      .getMySystemPermissions()
      .pipe(tap((x) => this.permissionsSubject.next(x)));
  }

  canViewAdiminstration() {
    return this.permissions$.pipe(
      map((x) => x.filter((y) => y.startsWith('View'))),
      map((x) => x.length > 0)
    );
  }

  hasPermission(permission: SystemPermission) {
    return this.permissions$.pipe(map((x) => x.includes(permission)));
  }

  loadProjectPermissions(projectId?: string) {
    return this.projectPermissionsService
      .getMyProjectPermissions(projectId)
      .pipe(tap((x) => this.projectPermissionsSubject.next(x)));
  }

  canEditProject(projectId: string): Observable<boolean> {
    return this.can(
      SystemPermission.EditProjects,
      projectId,
      ProjectPermission.EditProject
    );
  }

  canAdminLockProject(projectId: string): Observable<boolean> {
    return this.can(
      SystemPermission.LockFiles,
      projectId,
      ProjectPermission.LockFiles
    );
  }

  private can(
    permission: SystemPermission,
    projectId?: string,
    projectPermission?: ProjectPermission
  ) {
    return combineLatest([this.permissions$, this.projectPermissions$]).pipe(
      map(([permissions, projectPermissionClaims]) => {
        if (permissions.includes(permission)) {
          return true;
        } else if (projectId != null && projectPermission != null) {
          const projectPermissionClaim = projectPermissionClaims.find(
            (x) => x.projectId == projectId
          );

          if (
            projectPermissionClaim != null &&
            projectPermissionClaim.permissions.includes(projectPermission)
          ) {
            return true;
          }
        }

        return false;
      })
    );
  }
}
