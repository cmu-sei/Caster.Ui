// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { fireEvent, screen } from '@testing-library/angular';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DirectoryStore } from 'src/app/directories/state/directory.store';
import { FileStore } from 'src/app/files/state/file.store';
import {
  Directory,
  ProjectPermission,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { FilesFilterPipe } from 'src/app/project/pipes/files-filter-pipe';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DirectoryPanelComponent } from './directory-panel.component';

const directory: Directory = {
  id: 'dir1',
  name: 'network',
  projectId: 'p1',
  parentId: null,
};

async function renderPanel(grants: PermissionGrants) {
  const view = await renderComponent(DirectoryPanelComponent, {
    declarations: [FilesFilterPipe],
    imports: [
      MatExpansionModule,
      MatListModule,
      MatBadgeModule,
      MatIconModule,
      MatMenuModule,
      MatTooltipModule,
      MatDividerModule,
      MatButtonModule,
      MatDialogModule,
    ],
    providers: [...permissionDataProviders(grants)],
    inputs: { parentDirectory: directory },
  });
  TestBed.inject(DirectoryStore).set([directory]);
  TestBed.inject(FileStore).set([
    {
      id: 'f1',
      name: 'main.tf',
      directoryId: 'dir1',
      workspaceId: null,
      lockedById: null,
    },
  ]);
  view.fixture.detectChanges();
  return view;
}

const addLinks = ['Add File', 'Add Workspace', 'Add Directory', 'Add Design'];

describe('DirectoryPanelComponent', () => {
  /**
   * Verifies: the panel lists the directory's files, and with an EditProject claim offers every Add link.
   * Interacts with: PermissionService.canEditProject (real), real DirectoryQuery and FileQuery.
   * Data: directory network with file main.tf in project p1; an EditProject claim on p1.
   */
  it('offers the Add links with an EditProject claim', async () => {
    await renderPanel({
      projects: [
        { projectId: 'p1', permissions: [ProjectPermission.EditProject] },
      ],
    });

    expect(screen.getByText('main.tf')).toBeInTheDocument();
    for (const link of addLinks) {
      expect(screen.getByText(link)).toBeInTheDocument();
    }
  });

  /**
   * Verifies: without EditProjects or an EditProject claim on this project no Add link renders.
   * Interacts with: PermissionService.canEditProject (real).
   * Data: near misses: ViewProject and ManageProject on p1, EditProject on p9.
   */
  it('hides the Add links without edit rights on the project', async () => {
    await renderPanel({
      projects: [
        {
          projectId: 'p1',
          permissions: [
            ProjectPermission.ViewProject,
            ProjectPermission.ManageProject,
          ],
        },
        { projectId: 'p9', permissions: [ProjectPermission.EditProject] },
      ],
    });

    expect(screen.getByText('main.tf')).toBeInTheDocument();
    for (const link of addLinks) {
      expect(screen.queryByText(link)).not.toBeInTheDocument();
    }
  });

  /**
   * Verifies: the directory's context menu enables Edit and Delete with EditProjects and disables them without it, while Export and Import stay enabled for both (current behavior for Import).
   * Interacts with: onContextMenu() and the [disabled]="!(canEdit$ | async)" menu items; PermissionService (real).
   * Data: right-click on the directory header; EditProjects, then (near miss) ViewProjects.
   */
  it.each([
    {
      label: 'EditProjects',
      system: [SystemPermission.EditProjects],
      disabled: false,
    },
    {
      label: 'ViewProjects',
      system: [SystemPermission.ViewProjects],
      disabled: true,
    },
  ])(
    'sets the context menu Edit and Delete disabled to $disabled with $label',
    async ({ system, disabled }) => {
      await renderPanel({ system });

      fireEvent.contextMenu(screen.getByText('network'));

      const edit = await screen.findByRole('menuitem', { name: 'Edit' });
      const del = screen.getByRole('menuitem', { name: 'Delete' });
      expect(edit.hasAttribute('disabled')).toBe(disabled);
      expect(del.hasAttribute('disabled')).toBe(disabled);
      expect(screen.getByRole('menuitem', { name: 'Export' })).toBeEnabled();
      // Current behavior; see agent-docs/ui-test-bugs/caster.ui.md.
      expect(screen.getByRole('menuitem', { name: 'Import' })).toBeEnabled();
    },
  );
});
