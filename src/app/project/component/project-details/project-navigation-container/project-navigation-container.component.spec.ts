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
import { Router } from '@angular/router';
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
import { ProjectQuery } from '../../../state';
import { DirectoryQuery } from '../../../../directories/state';
import { ProjectNavigationContainerComponent } from './project-navigation-container.component';

@Component({ selector: 'cas-directory-panel', template: '', standalone: false })
class DirectoryPanelStub {
  @Input() parentDirectory: Directory;
}

async function renderNavigation(
  grants: PermissionGrants,
  queryParams: Record<string, string> = {},
) {
  const projectsApi = {
    getProject: vi.fn((id: string) => of<Project>({ id, name: 'Range' })),
  } satisfies ApiStub<ProjectsService>;
  const directoriesApi = {
    getDirectoriesByProject: vi.fn((projectId: string) =>
      of<Directory[]>([
        // the API includes files, workspaces and designs, empty or not
        {
          id: 'dir1',
          name: 'network',
          projectId,
          parentId: null,
          files: [],
          workspaces: [
            { id: 'ws1', name: 'prod', directoryId: 'dir1', runs: [] },
          ],
          designs: [],
        },
        {
          id: 'dir2',
          name: 'child',
          projectId,
          parentId: 'dir1',
          files: [],
          workspaces: [],
          designs: [],
        },
      ]),
    ),
  } satisfies ApiStub<DirectoriesService>;
  // RouterQuery.select is overloaded and generic; the container only reads
  // select('state').params and .queryParams.
  const routerQuery = {
    select: vi.fn(() => of({ params: { id: 'p1' }, queryParams })),
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

function openTabIds(view: Awaited<ReturnType<typeof renderNavigation>>) {
  const projectQuery = view.fixture.debugElement.injector.get(ProjectQuery);
  return (projectQuery.ui.getEntity('p1')?.openTabs ?? []).map((t) => t.id);
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

  /**
   * Verifies: ?workspace=<id> opens that workspace's tab and then drops the parameter from the URL.
   * Interacts with: RouterQuery.select (stub), real DirectoryService/WorkspaceStore/ProjectService.openTab, Router.navigate (spy).
   * Data: workspace ws1 in directory dir1 of project p1.
   */
  it('opens the workspace a link names', async () => {
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    const view = await renderNavigation({}, { workspace: 'ws1' });

    expect(openTabIds(view)).toEqual(['ws1']);
    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { workspace: null, directory: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    navigate.mockRestore();
  });

  /**
   * Verifies: a link to a workspace that is not in the routed project opens no tab and says so.
   * Interacts with: MatSnackBar (real), Router.navigate (spy).
   * Data: workspace ws9, not among p1's directories.
   */
  it('says so when the linked workspace is not in the project', async () => {
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    const view = await renderNavigation({}, { workspace: 'ws9' });

    expect(openTabIds(view)).toEqual([]);
    expect(
      await screen.findByText('The linked workspace is not in this project'),
    ).toBeInTheDocument();
    expect(navigate).toHaveBeenCalled();
    navigate.mockRestore();
  });

  /**
   * Verifies: ?directory=<id> expands that directory with its workspaces, and every directory above it with its subdirectories, without opening a tab.
   * Interacts with: DirectoryService.expandTo (real), DirectoryQuery UI state, Router.navigate (spy).
   * Data: directory dir2 under dir1 in project p1.
   */
  it('expands the directory a link names', async () => {
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    const view = await renderNavigation({}, { directory: 'dir2' });
    const directories = view.fixture.debugElement.injector.get(DirectoryQuery);

    expect(directories.ui.getEntity('dir2')).toMatchObject({ isExpanded: true, isWorkspacesExpanded: true });
    expect(directories.ui.getEntity('dir1')).toMatchObject({ isExpanded: true, isDirectoriesExpanded: true });
    expect(openTabIds(view)).toEqual([]);
    expect(navigate).toHaveBeenCalled();
    navigate.mockRestore();
  });

  /**
   * Verifies: a link to a directory that is not in the routed project says so.
   * Interacts with: MatSnackBar (real).
   * Data: directory dir9, not among p1's directories.
   */
  it('says so when the linked directory is not in the project', async () => {
    const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    await renderNavigation({}, { directory: 'dir9' });

    expect(
      await screen.findByText('The linked directory is not in this project'),
    ).toBeInTheDocument();
    navigate.mockRestore();
  });
});
