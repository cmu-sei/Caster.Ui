// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { PermissionStore } from './permission.store';
import { Injectable } from '@angular/core';
import { PermissionsService, Permission } from '../../generated/caster-api';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  constructor(
    private permissionStore: PermissionStore,
    private permissionsService: PermissionsService
  ) {}

  load(): Observable<Permission[]> {
    this.permissionStore.setLoading(true);
    return this.permissionsService.getAllPermissions().pipe(
      tap((permissions: Permission[]) => {
        this.permissionStore.set(permissions);
      }),
      tap(() => {
        this.permissionStore.setLoading(false);
      })
    );
  }

  loadPermissionById(id: string): Observable<Permission> {
    this.permissionStore.setLoading(true);
    return this.permissionsService.getPermission(id).pipe(
      tap((_permission: Permission) => {
        this.permissionStore.upsert(_permission.id, { ..._permission });
      }),
      tap(() => {
        this.permissionStore.setLoading(false);
      })
    );
  }
}
