// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Provider } from '@angular/core';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  Project,
  ProjectPermission,
  SystemPermission,
} from 'src/app/generated/caster-api';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectListComponent } from './project-list.component';

const projects: Project[] = [
  { id: 'p1', name: 'Alpha', description: 'first' },
  { id: 'p2', name: 'Bravo', description: 'second' },
];

async function renderProjectList(
  grants: PermissionGrants,
  manageMode = false,
  providers: Provider[] = [],
) {
  const selectedProjectId = vi.fn<(id: string) => void>();
  const view = await renderComponent(ProjectListComponent, {
    imports: [
      MatTableModule,
      MatSortModule,
      MatPaginatorModule,
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatCardModule,
      MatProgressSpinnerModule,
      MatDialogModule,
    ],
    providers: [...permissionDataProviders(grants), ...providers],
    inputs: { projects, isLoading: false, manageMode },
    on: { selectedProjectId },
  });
  return { ...view, selectedProjectId, user: userEvent.setup() };
}

/** The names of the projects whose own table row has the named action button. */
function projectsOffering(action: (project: Project) => string): string[] {
  const rows = within(screen.getByRole('table')).getAllByRole('row');
  return projects
    .filter((p) => {
      const row = rows.find((r) => within(r).queryByText(p.name ?? ''));
      return row && within(row).queryByRole('button', { name: action(p) });
    })
    .map((p) => p.name ?? '');
}

/** One grant per row; the Manage grants are what the template checks, the Edit grants what the API checks. */
const actionGrants: [string, PermissionGrants, string[]][] = [
  [
    'ManageProjects',
    { system: [SystemPermission.ManageProjects] },
    ['Alpha', 'Bravo'],
  ],
  [
    'a ManageProject claim on p1',
    {
      projects: [
        { projectId: 'p1', permissions: [ProjectPermission.ManageProject] },
      ],
    },
    ['Alpha'],
  ],
  [
    'a ManageProject claim on another project',
    {
      projects: [
        { projectId: 'p9', permissions: [ProjectPermission.ManageProject] },
      ],
    },
    [],
  ],
  [
    'an EditProject claim on p1',
    {
      projects: [
        { projectId: 'p1', permissions: [ProjectPermission.EditProject] },
      ],
    },
    [],
  ],
  ['EditProjects', { system: [SystemPermission.EditProjects] }, []],
];

describe('ProjectListComponent', () => {
  /**
   * Verifies: CreateProjects shows Add New Project.
   * Interacts with: PermissionService.hasPermission (real).
   * Data: system permission CreateProjects.
   */
  it('shows Add New Project with CreateProjects', async () => {
    await renderProjectList({ system: [SystemPermission.CreateProjects] });

    expect(
      screen.getByRole('button', { name: 'Add New Project' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: without CreateProjects there is no Add New Project button.
   * Interacts with: PermissionService.hasPermission (real).
   * Data: near miss: system permissions ViewProjects and ImportProjects.
   */
  it('hides Add New Project without CreateProjects', async () => {
    await renderProjectList({
      system: [SystemPermission.ViewProjects, SystemPermission.ImportProjects],
    });

    expect(
      screen.queryByRole('button', { name: 'Add New Project' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: Rename appears on every project with ManageProjects, on a project with a ManageProject claim, and nowhere for an EditProject claim or the EditProjects system permission (current behavior).
   * Interacts with: PermissionService.permissions$ and projectPermissions$ (real), ProjectPermissionsService (stub).
   * Data: projects Alpha (p1) and Bravo (p2); actionGrants; near misses: ManageProject on another project, EditProject on p1, EditProjects.
   */
  it.each(actionGrants)(
    'offers Rename for %s: %j',
    async (_label, grants, expected) => {
      await renderProjectList(grants);

      // Current behavior for the EditProject rows; see agent-docs/ui-test-bugs/caster.ui.md.
      expect(projectsOffering(() => 'Rename')).toEqual(expected);
    },
  );

  /**
   * Verifies: Delete appears on every project with ManageProjects, on a project with a ManageProject claim, and nowhere for an EditProject claim or the EditProjects system permission (current behavior).
   * Interacts with: PermissionService.permissions$ and projectPermissions$ (real), ProjectPermissionsService (stub).
   * Data: projects Alpha (p1) and Bravo (p2); actionGrants; near misses as for Rename.
   */
  it.each(actionGrants)(
    'offers Delete for %s: %j',
    async (_label, grants, expected) => {
      await renderProjectList(grants);

      // Current behavior for the EditProject rows; see agent-docs/ui-test-bugs/caster.ui.md.
      expect(projectsOffering((p) => `Delete ${p.name}`)).toEqual(expected);
    },
  );

  /**
   * Verifies: Add New Project opens the name dialog titled "Add Project".
   * Interacts with: the real MatDialog and NameDialogComponent.
   * Data: system permission CreateProjects.
   */
  it('titles the add dialog Add Project', async () => {
    const { user } = await renderProjectList({
      system: [SystemPermission.CreateProjects],
    });

    await user.click(screen.getByRole('button', { name: 'Add New Project' }));

    expect(
      await screen.findByRole('heading', { name: 'Add Project' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: Delete on a project with no workspaces asks "Delete Project" / "Are you sure that you want to delete <name>?" with a Delete button.
   * Interacts with: CrucibleDialogService.confirm (stub answering false), real DirectoryQuery and WorkspaceQuery (empty).
   * Data: system permission ManageProjects; Alpha deleted.
   */
  it('confirms a delete with the standard wording', async () => {
    const { dialogRef } = dialogRefStub<unknown, boolean>(false);
    const confirm = vi.fn(() => dialogRef);
    const { user } = await renderProjectList(
      { system: [SystemPermission.ManageProjects] },
      false,
      [
        {
          provide: CrucibleDialogService,
          useValue: { confirm } satisfies Pick<
            CrucibleDialogService,
            'confirm'
          >,
        },
      ],
    );

    await user.click(screen.getByRole('button', { name: 'Delete Alpha' }));

    expect(confirm).toHaveBeenCalledWith({
      title: 'Delete Project',
      message: 'Are you sure that you want to delete Alpha?',
      confirmText: 'Delete',
    });
  });

  /**
   * Verifies: in manage mode clicking a project name selects it instead of navigating.
   * Interacts with: the selectedProjectId output.
   * Data: manage mode; Bravo clicked.
   */
  it('selects a project in manage mode', async () => {
    const { selectedProjectId, user } = await renderProjectList(
      { system: [SystemPermission.ManageProjects] },
      true,
    );

    await user.click(screen.getByText('Bravo'));

    expect(selectedProjectId).toHaveBeenCalledWith('p2');
  });
});
