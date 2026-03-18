// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ProjectMembershipsPageComponent } from './project-memberships-page.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PermissionService } from 'src/app/permissions/permission.service';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import {
  SystemPermission,
  ProjectPermission,
} from 'src/app/generated/caster-api';

function makeActivatedRoute(projectId: string) {
  return {
    provide: ActivatedRoute,
    useValue: {
      params: of({ id: projectId }),
      paramMap: of({ get: (key: string) => (key === 'id' ? projectId : null), has: () => true }),
      queryParams: of({}),
      snapshot: {
        params: { id: projectId },
        paramMap: { get: (key: string) => (key === 'id' ? projectId : null), has: () => true },
      },
    },
  };
}

async function renderMembershipsPage(
  projectId = 'proj-1',
  extraProviders: any[] = []
) {
  return renderComponent(ProjectMembershipsPageComponent, {
    declarations: [ProjectMembershipsPageComponent],
    providers: [
      makeActivatedRoute(projectId),
      permissionProvider(),
      ...extraProviders,
    ],
  });
}

describe('ProjectMembershipsPageComponent', () => {
  it('should render without error', async () => {
    const { fixture } = await renderMembershipsPage();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should assign projectId from route params on init', async () => {
    const { fixture } = await renderMembershipsPage('test-project-id');
    expect(fixture.componentInstance.projectId).toBe('test-project-id');
  });

  it('should call loadProjectPermissions with the route projectId on init', async () => {
    const projectId = 'proj-abc';
    const loadProjectPermissions = vi.fn().mockReturnValue(of([]));

    const { fixture } = await renderComponent(ProjectMembershipsPageComponent, {
      declarations: [ProjectMembershipsPageComponent],
      providers: [
        makeActivatedRoute(projectId),
        {
          provide: PermissionService,
          useValue: {
            permissions$: of([]),
            projectPermissions$: of([]),
            load: () => of([]),
            loadProjectPermissions,
            canViewAdiminstration: () => of(false),
            hasPermission: () => of(false),
            canEditProject: () => of(false),
            canManageProject: () => of(false),
            canAdminLockProject: () => of(false),
          },
        },
      ],
    });

    expect(loadProjectPermissions).toHaveBeenCalledWith(projectId);
  });

  it('should call loadProjectPermissions exactly once on init', async () => {
    const projectId = 'proj-once';
    const loadProjectPermissions = vi.fn().mockReturnValue(of([]));

    await renderComponent(ProjectMembershipsPageComponent, {
      declarations: [ProjectMembershipsPageComponent],
      providers: [
        makeActivatedRoute(projectId),
        {
          provide: PermissionService,
          useValue: {
            permissions$: of([]),
            projectPermissions$: of([]),
            load: () => of([]),
            loadProjectPermissions,
            canViewAdiminstration: () => of(false),
            hasPermission: () => of(false),
            canEditProject: () => of(false),
            canManageProject: () => of(false),
            canAdminLockProject: () => of(false),
          },
        },
      ],
    });

    expect(loadProjectPermissions).toHaveBeenCalledTimes(1);
  });

  it('should work with ManageProject system permission', async () => {
    const projectId = 'proj-manage';
    const loadProjectPermissions = vi.fn().mockReturnValue(of([]));

    const { fixture } = await renderComponent(ProjectMembershipsPageComponent, {
      declarations: [ProjectMembershipsPageComponent],
      providers: [
        makeActivatedRoute(projectId),
        {
          provide: PermissionService,
          useValue: {
            permissions$: of([SystemPermission.ManageProjects]),
            projectPermissions$: of([]),
            load: () => of([SystemPermission.ManageProjects]),
            loadProjectPermissions,
            canViewAdiminstration: () => of(true),
            hasPermission: (p: SystemPermission) =>
              of(p === SystemPermission.ManageProjects),
            canEditProject: () => of(true),
            canManageProject: () => of(true),
            canAdminLockProject: () => of(false),
          },
        },
      ],
    });

    expect(fixture.componentInstance.projectId).toBe(projectId);
    expect(loadProjectPermissions).toHaveBeenCalledWith(projectId);
  });

  it('should work with project-level ManageProject permission', async () => {
    const projectId = 'proj-level';
    const loadProjectPermissions = vi.fn().mockReturnValue(of([]));

    const { fixture } = await renderComponent(ProjectMembershipsPageComponent, {
      declarations: [ProjectMembershipsPageComponent],
      providers: [
        makeActivatedRoute(projectId),
        {
          provide: PermissionService,
          useValue: {
            permissions$: of([]),
            projectPermissions$: of([
              {
                projectId,
                permissions: [ProjectPermission.ManageProject],
              },
            ]),
            load: () => of([]),
            loadProjectPermissions,
            canViewAdiminstration: () => of(false),
            hasPermission: () => of(false),
            canEditProject: () => of(false),
            canManageProject: (id: string) => of(id === projectId),
            canAdminLockProject: () => of(false),
          },
        },
      ],
    });

    expect(fixture.componentInstance.projectId).toBe(projectId);
    expect(loadProjectPermissions).toHaveBeenCalledWith(projectId);
  });
});
