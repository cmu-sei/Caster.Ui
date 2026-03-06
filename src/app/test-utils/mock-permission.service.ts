// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Provider } from '@angular/core';
import { of } from 'rxjs';
import {
  SystemPermission,
  ProjectPermission,
  ProjectPermissionsClaim,
} from '../generated/caster-api';
import { PermissionService } from '../permissions/permission.service';

export function permissionProvider(
  systemPerms: SystemPermission[] = [],
  projectPerms: ProjectPermissionsClaim[] = []
): Provider {
  return {
    provide: PermissionService,
    useValue: {
      permissions$: of(systemPerms),
      projectPermissions$: of(projectPerms),
      load: () => of(systemPerms),
      loadProjectPermissions: () => of(projectPerms),
      canViewAdiminstration: () =>
        of(systemPerms.some((p) => p.startsWith('View'))),
      hasPermission: (p: SystemPermission) => of(systemPerms.includes(p)),
      canEditProject: (projectId: string) =>
        of(
          systemPerms.includes(SystemPermission.EditProjects) ||
            projectPerms.some(
              (c) =>
                c.projectId === projectId &&
                c.permissions.includes(ProjectPermission.EditProject)
            )
        ),
      canManageProject: (projectId: string) =>
        of(
          systemPerms.includes(SystemPermission.ManageProjects) ||
            projectPerms.some(
              (c) =>
                c.projectId === projectId &&
                c.permissions.includes(ProjectPermission.ManageProject)
            )
        ),
      canAdminLockProject: (projectId: string) =>
        of(
          systemPerms.includes(SystemPermission.LockFiles) ||
            projectPerms.some(
              (c) =>
                c.projectId === projectId &&
                c.permissions.includes(ProjectPermission.LockFiles)
            )
        ),
    },
  };
}
