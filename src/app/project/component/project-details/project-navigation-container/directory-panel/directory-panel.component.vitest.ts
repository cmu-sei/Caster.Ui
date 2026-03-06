// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { DirectoryPanelComponent } from './directory-panel.component';
import { FilesFilterPipe } from '../../../../pipes/files-filter-pipe';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import {
  SystemPermission,
  ProjectPermission,
  ProjectPermissionsClaim,
} from 'src/app/generated/caster-api';
import { DesignQuery } from 'src/app/designs/state/design.query';
import { DesignService } from 'src/app/designs/state/design.service';
import { DirectoryQuery } from 'src/app/directories/state';
import { of } from 'rxjs';

const sharedImports = [
  CommonModule,
  MatExpansionModule,
  MatListModule,
  MatMenuModule,
  MatIconModule,
  MatBadgeModule,
  MatDialogModule,
  MatDividerModule,
  MatTooltipModule,
];

const mockDir = { id: 'd-1', name: 'root', projectId: 'p-1' } as any;

const expandedUI = {
  isExpanded: true,
  isFilesExpanded: true,
  isWorkspacesExpanded: true,
  isDirectoriesExpanded: true,
  isDesignsExpanded: true,
};

async function renderDirectoryPanel(overrides: { providers?: any[] } = {}) {
  return renderComponent(DirectoryPanelComponent, {
    declarations: [DirectoryPanelComponent, FilesFilterPipe],
    imports: sharedImports,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      {
        provide: DesignQuery,
        useValue: {
          selectAll: () => of([]),
          getEntity: () => null,
        },
      },
      {
        provide: DesignService,
        useValue: {
          create: () => {},
          edit: () => {},
          delete: () => {},
          toggleEnabled: () => {},
        },
      },
      {
        provide: DirectoryQuery,
        useValue: {
          selectAll: () => of([]),
          select: () => of(null),
          selectEntity: () => of(null),
          getAll: () => [],
          getEntity: () => null,
          ui: {
            selectEntity: () => of(expandedUI),
            selectAll: () => of([expandedUI]),
          },
        },
      },
      ...(overrides.providers ?? []),
    ],
    componentProperties: {
      parentDirectory: mockDir,
    },
  });
}

describe('DirectoryPanelComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderDirectoryPanel();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the directory name', async () => {
    await renderDirectoryPanel();
    expect(screen.getByText('root')).toBeInTheDocument();
  });

  it('should show Add File link with EditProject system permission', async () => {
    await renderDirectoryPanel({
      providers: [permissionProvider([SystemPermission.EditProjects])],
    });

    expect(screen.getByText('Add File')).toBeInTheDocument();
  });

  it('should hide Add File link without EditProject permission', async () => {
    await renderDirectoryPanel({
      providers: [permissionProvider([])],
    });

    expect(screen.queryByText('Add File')).not.toBeInTheDocument();
  });

  it('should show Add File link with project-level EditProject permission', async () => {
    const projectClaim: ProjectPermissionsClaim = {
      projectId: 'p-1',
      permissions: [ProjectPermission.EditProject],
    };
    await renderDirectoryPanel({
      providers: [permissionProvider([], [projectClaim])],
    });

    expect(screen.getByText('Add File')).toBeInTheDocument();
  });

  it('should show section headers', async () => {
    await renderDirectoryPanel();

    expect(screen.getByText('FILES')).toBeInTheDocument();
    expect(screen.getByText('WORKSPACES')).toBeInTheDocument();
    expect(screen.getByText('DIRECTORIES')).toBeInTheDocument();
    expect(screen.getByText('DESIGNS')).toBeInTheDocument();
  });
});
