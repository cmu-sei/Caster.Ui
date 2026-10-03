// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// Provides caster.ui's REAL PermissionService over stubbed "my permissions"
// endpoints, so gate tests exercise the production rules (a system permission
// first, then the matching project or group claim) instead of a
// re-implementation that can drift from them.

import { inject, Provider } from '@angular/core';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  GroupPermissionsClaim,
  GroupPermissionsService,
  ProjectPermissionsClaim,
  ProjectPermissionsService,
  SystemPermission,
  SystemPermissionsService,
} from '../generated/caster-api';
import { PermissionService } from '../permissions/permission.service';
import { ApiStub } from './api-stub';

export interface PermissionGrants {
  /** As `SystemPermissionsService.getMySystemPermissions` returns them. */
  system?: SystemPermission[];
  /** As `ProjectPermissionsService.getMyProjectPermissions` returns them. */
  projects?: ProjectPermissionsClaim[];
  /** As `GroupPermissionsService.getMyGroupPermissions` returns them. */
  groups?: GroupPermissionsClaim[];
}

export function permissionApiStubs(grants: PermissionGrants = {}) {
  return {
    systemPermissions: {
      getMySystemPermissions: vi.fn(() =>
        of<SystemPermission[]>([...(grants.system ?? [])]),
      ),
    } satisfies ApiStub<SystemPermissionsService>,
    projectPermissions: {
      getMyProjectPermissions: vi.fn((_projectId?: string) =>
        of<ProjectPermissionsClaim[]>(structuredClone(grants.projects ?? [])),
      ),
    } satisfies ApiStub<ProjectPermissionsService>,
    groupPermissions: {
      getMyGroupPermissions: vi.fn(() =>
        of<GroupPermissionsClaim[]>(structuredClone(grants.groups ?? [])),
      ),
    } satisfies ApiStub<GroupPermissionsService>,
  };
}

export function permissionDataProviders(
  grants: PermissionGrants = {},
): Provider[] {
  const stubs = permissionApiStubs(grants);
  return [
    { provide: SystemPermissionsService, useValue: stubs.systemPermissions },
    { provide: ProjectPermissionsService, useValue: stubs.projectPermissions },
    { provide: GroupPermissionsService, useValue: stubs.groupPermissions },
    {
      provide: PermissionService,
      // PermissionService resolves its API services with inject(), so the
      // factory's injection context hands it the stubs above (or a test's own
      // override).
      useFactory: () => {
        const service = new PermissionService();
        // The app loads system and group permissions in the top bar and the
        // admin container, and project claims in the project list and project
        // pages; components assume they are already loaded.
        service.load().subscribe();
        service.loadProjectPermissions().subscribe();
        service.loadGroupPermissions().subscribe();
        return service;
      },
    },
  ];
}
