// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ProjectNavigationContainerComponent } from './project-navigation-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { ProjectStore, ProjectQuery, ProjectService } from '../../../state';
import {
  DirectoryQuery,
  DirectoryService,
} from '../../../../directories/state';
import { PermissionService } from 'src/app/permissions/permission.service';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import {
  SystemPermission,
  ProjectPermission,
} from 'src/app/generated/caster-api';
import { MatDialog } from '@angular/material/dialog';
import { screen } from '@testing-library/angular';

function makeRouterQuery(projectId: string) {
  return {
    provide: RouterQuery,
    useValue: {
      select: () => of({ params: { id: projectId }, queryParams: {} }),
      selectParams: () => of({ id: projectId }),
    },
  };
}

function makeProjectQuery(projectId: string) {
  return {
    provide: ProjectQuery,
    useValue: {
      selectActive: () => of({ id: projectId, name: 'Test Project' }),
      select: () => of(null),
      selectEntity: () => of(null),
      selectLoading: () => of(false),
      getRightSidebarOpen$: () => of(false),
      getRightSidebarView$: () => of(''),
      getRightSidebarWidth: () => of(300),
      selectSelectedTab: () => of(0),
      selectOpenTabs: () => of([]),
      getEntity: () => null,
      getAll: () => [],
      getActive: () => ({ id: projectId, name: 'Test Project' }),
    },
  };
}

function makeProjectService() {
  return {
    provide: ProjectService,
    useValue: {
      loadProjects: () => of([]),
      loadProject: () => of({}),
      createProject: () => of({}),
      deleteProject: () => of(null),
      setSelectedTab: () => {},
      closeTab: () => {},
      openTab: () => {},
    },
  };
}

function makeDirectoryQuery(projectId: string) {
  return {
    provide: DirectoryQuery,
    useValue: {
      selectAll: (opts?: any) => of([]),
      select: () => of(null),
      selectEntity: () => of(null),
      getAll: () => [],
      getEntity: () => null,
      ui: {
        selectEntity: () => of(null),
        selectAll: () => of([]),
      },
    },
  };
}

function makeDirectoryService() {
  return {
    provide: DirectoryService,
    useValue: {
      loadDirectories: () => of([]),
      add: () => {},
      update: () => {},
      delete: () => {},
      toggleIsExpanded: () => {},
    },
  };
}

async function renderNavigation(
  projectId: string,
  systemPerms: SystemPermission[] = [],
  projectPerms: { projectId: string; permissions: ProjectPermission[] }[] = []
) {
  return renderComponent(ProjectNavigationContainerComponent, {
    declarations: [ProjectNavigationContainerComponent],
    imports: [CommonModule, MatDialogModule, MatIconModule],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      makeRouterQuery(projectId),
      {
        provide: ProjectStore,
        useValue: {
          setActive: () => {},
          ui: { setActive: () => {} },
        },
      },
      makeProjectQuery(projectId),
      makeProjectService(),
      makeDirectoryQuery(projectId),
      makeDirectoryService(),
      permissionProvider(systemPerms, projectPerms),
      {
        provide: MatDialog,
        useValue: { open: () => ({ afterClosed: () => of(null) }) },
      },
    ],
  });
}

describe('ProjectNavigationContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(
      ProjectNavigationContainerComponent,
      {
        declarations: [ProjectNavigationContainerComponent],
        imports: [CommonModule, MatDialogModule, MatIconModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          {
            provide: RouterQuery,
            useValue: {
              select: () => of({ params: { id: 'p-1' }, queryParams: {} }),
              selectParams: () => of({ id: 'p-1' }),
            },
          },
          {
            provide: ProjectStore,
            useValue: {
              setActive: () => {},
              ui: { setActive: () => {} },
            },
          },
        ],
      }
    );
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Add Directory when user has system-level EditProjects permission', async () => {
    const projectId = 'proj-1';
    await renderNavigation(projectId, [SystemPermission.EditProjects]);
    expect(screen.getByText('Add Directory')).toBeInTheDocument();
  });

  it('should hide Add Directory when user has no edit permission', async () => {
    const projectId = 'proj-1';
    await renderNavigation(projectId, []);
    expect(screen.queryByText('Add Directory')).not.toBeInTheDocument();
  });

  it('should show Add Directory when user has project-level EditProject permission', async () => {
    const projectId = 'proj-2';
    await renderNavigation(
      projectId,
      [],
      [{ projectId, permissions: [ProjectPermission.EditProject] }]
    );
    expect(screen.getByText('Add Directory')).toBeInTheDocument();
  });

  it('should hide Add Directory for a different projectId than the permission claim', async () => {
    const projectId = 'proj-3';
    await renderNavigation(
      projectId,
      [],
      [
        {
          projectId: 'other-proj',
          permissions: [ProjectPermission.EditProject],
        },
      ]
    );
    expect(screen.queryByText('Add Directory')).not.toBeInTheDocument();
  });

  it('should always show Export Project regardless of edit permission', async () => {
    const projectId = 'proj-export';
    await renderNavigation(projectId, []);
    expect(screen.getByText('Export Project')).toBeInTheDocument();
  });

  it('should always show Import Project regardless of edit permission', async () => {
    const projectId = 'proj-import';
    await renderNavigation(projectId, []);
    expect(screen.getByText('Import Project')).toBeInTheDocument();
  });
});
