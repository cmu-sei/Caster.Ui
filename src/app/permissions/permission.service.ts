// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { inject, Injectable } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  throwError,
} from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import {
  GroupPermission,
  GroupPermissionsClaim,
  GroupPermissionsService,
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

  private groupPermissionsSubject = new BehaviorSubject<
    GroupPermissionsClaim[]
  >([]);
  public groupPermissions$ = this.groupPermissionsSubject.asObservable();

  // Cached in-flight/last request so the several components that each declare a
  // dependency on group permissions (topbar, admin-container, admin-groups) share
  // a single GET /api/permissions/group/mine instead of firing one apiece.
  private groupPermissionsCache: Observable<GroupPermissionsClaim[]> | null =
    null;

  private readonly permissionsService = inject(SystemPermissionsService);
  private readonly projectPermissionsService = inject(ProjectPermissionsService);
  private readonly groupPermissionsService = inject(GroupPermissionsService);

  load(): Observable<SystemPermission[]> {
    return this.permissionsService
      .getMySystemPermissions()
      .pipe(tap((x) => this.permissionsSubject.next(x)));
  }

  canViewAdiminstration() {
    return combineLatest([this.permissions$, this.groupPermissions$]).pipe(
      map(
        ([permissions, groupPermissionClaims]) =>
          permissions.filter((y) => y.startsWith('View')).length > 0 ||
          this.hasManageMembershipClaim(groupPermissionClaims)
      )
    );
  }

  canViewGroupsAdmin() {
    return combineLatest([this.permissions$, this.groupPermissions$]).pipe(
      map(
        ([permissions, groupPermissionClaims]) =>
          permissions.includes(SystemPermission.ViewGroups) ||
          this.hasManageMembershipClaim(groupPermissionClaims)
      )
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

  canManageProject(projectId: string): Observable<boolean> {
    return this.can(
      SystemPermission.ManageProjects,
      projectId,
      ProjectPermission.ManageProject
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

  // Loads the full current-user group claims set. Callers keep calling this
  // wherever they depend on group permissions; the cache dedups the redundant
  // network round-trip. Pass forceReload = true to rebuild after the current
  // user's own claims may have changed (e.g. a self-demotion or self-removal
  // from a group).
  loadGroupPermissions(
    forceReload = false
  ): Observable<GroupPermissionsClaim[]> {
    if (this.groupPermissionsCache && !forceReload) {
      return this.groupPermissionsCache;
    }

    this.groupPermissionsCache = this.groupPermissionsService
      .getMyGroupPermissions()
      .pipe(
        tap((x) => this.groupPermissionsSubject.next(x)),
        catchError((err) => {
          this.groupPermissionsCache = null; // allow retry after failure
          return throwError(() => err);
        }),
        shareReplay(1)
      );

    return this.groupPermissionsCache;
  }

  private hasManageMembershipClaim(
    groupPermissionClaims: GroupPermissionsClaim[]
  ): boolean {
    return groupPermissionClaims.some((x) =>
      x.permissions.includes(GroupPermission.ManageMembership)
    );
  }

  canManageGroup(groupId: string): Observable<boolean> {
    return this.canGroup(
      SystemPermission.ManageGroups,
      groupId,
      GroupPermission.ManageMembership
    );
  }

  canEditGroup(groupId: string): Observable<boolean> {
    return this.canGroup(
      SystemPermission.ManageGroups,
      groupId,
      GroupPermission.EditGroup
    );
  }

  private canGroup(
    permission: SystemPermission,
    groupId?: string,
    groupPermission?: GroupPermission
  ) {
    return combineLatest([this.permissions$, this.groupPermissions$]).pipe(
      map(([permissions, groupPermissionClaims]) => {
        if (permissions.includes(permission)) {
          return true;
        } else if (groupId != null && groupPermission != null) {
          const groupPermissionClaim = groupPermissionClaims.find(
            (x) => x.groupId == groupId
          );

          if (
            groupPermissionClaim != null &&
            groupPermissionClaim.permissions.includes(groupPermission)
          ) {
            return true;
          }
        }

        return false;
      })
    );
  }
}
