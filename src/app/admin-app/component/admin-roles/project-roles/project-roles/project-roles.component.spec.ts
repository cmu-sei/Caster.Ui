// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ProjectPermission,
  ProjectRole,
  ProjectRolesService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectRolesComponent } from './project-roles.component';

describe('ProjectRolesComponent', () => {
  /**
   * Verifies: the matrix has one column per project role, sorted by name, with a checked box where the role holds the permission.
   * Interacts with: ProjectRolesService.getAllProjectRoles (stub), real ProjectRoleService.
   * Data: roles Viewer (ViewProject) and Manager (all permissions), returned out of order.
   */
  it('renders the permission matrix of the project roles', async () => {
    const projectRolesApi = {
      getAllProjectRoles: vi.fn(() =>
        of<ProjectRole[]>([
          {
            id: 'r2',
            name: 'Viewer',
            allPermissions: false,
            permissions: [ProjectPermission.ViewProject],
          },
          { id: 'r1', name: 'Manager', allPermissions: true, permissions: [] },
        ]),
      ),
    } satisfies ApiStub<ProjectRolesService>;
    await renderComponent(ProjectRolesComponent, {
      imports: [
        MatTableModule,
        MatCheckboxModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
      ],
      providers: [{ provide: ProjectRolesService, useValue: projectRolesApi }],
    });

    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent?.trim()),
    ).toEqual(['Permissions', 'Manager', 'Viewer']);
    const viewRow = within(table)
      .getByRole('button', { name: 'About ViewProject' })
      .closest('tr') as HTMLElement;
    // Manager has allPermissions, so only its All row has a checkbox.
    expect(within(viewRow).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(viewRow).getByRole('checkbox')).toBeChecked();
  });
});
