// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import {
  DirectoriesService,
  Directory,
  Project,
  ProjectPermission,
  ProjectsService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectNavigationContainerComponent } from './project-navigation-container.component';

@Component({ selector: 'cas-directory-panel', template: '', standalone: false })
class DirectoryPanelStub {
  @Input() parentDirectory: Directory;
}

async function renderNavigation(grants: PermissionGrants) {
  const projectsApi = {
    getProject: vi.fn((id: string) => of<Project>({ id, name: 'Range' })),
  } satisfies ApiStub<ProjectsService>;
  const directoriesApi = {
    getDirectoriesByProject: vi.fn((projectId: string) =>
      of<Directory[]>([
        { id: 'dir1', name: 'network', projectId, parentId: null },
        { id: 'dir2', name: 'child', projectId, parentId: 'dir1' },
      ]),
    ),
  } satisfies ApiStub<DirectoriesService>;
  // RouterQuery.select is overloaded and generic; the container only reads
  // select('state').params.
  const routerQuery = {
    select: vi.fn(() => of({ params: { id: 'p1' } })),
  } as unknown as Pick<RouterQuery, 'select'>;
  const view = await renderComponent(ProjectNavigationContainerComponent, {
    declarations: [DirectoryPanelStub],
    imports: [MatIconModule, MatTooltipModule, MatDialogModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ProjectsService, useValue: projectsApi },
      { provide: DirectoriesService, useValue: directoriesApi },
      { provide: RouterQuery, useValue: routerQuery },
    ],
  });
  return { ...view, projectsApi };
}

describe('ProjectNavigationContainerComponent', () => {
  /**
   * Verifies: the routed project loads, and one directory panel renders per root directory.
   * Interacts with: RouterQuery.select (stub), ProjectsService.getProject and DirectoriesService.getDirectoriesByProject (stubs), real ProjectQuery and DirectoryQuery.
   * Data: route id p1; root directory network with child directory child.
   */
  it('lists the root directories of the routed project', async () => {
    const { fixture, projectsApi } = await renderNavigation({});

    expect(projectsApi.getProject).toHaveBeenCalledWith('p1');
    const panels: DirectoryPanelStub[] = fixture.debugElement
      .queryAll(By.directive(DirectoryPanelStub))
      .map((d) => d.componentInstance);
    expect(panels.map((p) => p.parentDirectory.id)).toEqual(['dir1']);
    expect(screen.getByText('Export Project')).toBeInTheDocument();
  });

  /**
   * Verifies: Add Directory appears with an EditProject claim on the project, or with EditProjects.
   * Interacts with: PermissionService.canEditProject (real).
   * Data: an EditProject claim on p1, then the EditProjects system permission.
   */
  it.each<[string, PermissionGrants]>([
    [
      'an EditProject claim',
      {
        projects: [
          { projectId: 'p1', permissions: [ProjectPermission.EditProject] },
        ],
      },
    ],
    ['EditProjects', { system: [SystemPermission.EditProjects] }],
  ])('offers Add Directory with %s', async (_label, grants) => {
    await renderNavigation(grants);

    expect(screen.getByText('Add Directory')).toBeInTheDocument();
  });

  /**
   * Verifies: without EditProjects or an EditProject claim on this project there is no Add Directory link, while Import Project is still offered (current behavior).
   * Interacts with: PermissionService.canEditProject (real).
   * Data: near misses: ViewProject and ImportProject on p1, EditProject on p9.
   */
  it('hides Add Directory without edit rights on the project', async () => {
    await renderNavigation({
      projects: [
        {
          projectId: 'p1',
          permissions: [
            ProjectPermission.ViewProject,
            ProjectPermission.ImportProject,
          ],
        },
        { projectId: 'p9', permissions: [ProjectPermission.EditProject] },
      ],
    });

    expect(screen.queryByText('Add Directory')).not.toBeInTheDocument();
    // Current behavior; see agent-docs/ui-test-bugs/caster.ui.md.
    expect(screen.getByText('Import Project')).toBeInTheDocument();
  });
});
