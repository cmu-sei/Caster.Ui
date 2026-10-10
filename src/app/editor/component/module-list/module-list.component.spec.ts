// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Module } from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ModuleListComponent } from './module-list.component';

const modules: Module[] = [
  { id: 'mod1', name: 'web', path: 'g/web', versionsCount: 2 },
  { id: 'mod2', name: 'db', path: 'g/db', versionsCount: 1 },
  { id: 'mod3', name: 'empty', path: 'g/empty', versionsCount: 0 },
];

async function renderModuleList() {
  const getModule = vi.fn<(m: { id: string; name: string }) => void>();
  const view = await renderComponent(ModuleListComponent, {
    imports: [
      MatCardModule,
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatDialogModule,
    ],
    inputs: { modules, isEditing: true },
    on: { getModule },
  });
  return { ...view, getModule, user: userEvent.setup() };
}

describe('ModuleListComponent', () => {
  /**
   * Verifies: modules without versions are left out of the list, and clicking a module asks for it by id and name.
   * Interacts with: the modules input setter, the getModule output.
   * Data: modules web (2 versions), db (1) and empty (0); db clicked.
   */
  it('lists the modules that have versions and selects one', async () => {
    const { getModule, user } = await renderModuleList();

    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.queryByText('empty')).not.toBeInTheDocument();
    await user.click(screen.getByText('db'));

    expect(getModule).toHaveBeenCalledWith({ id: 'mod2', name: 'db' });
  });

  /**
   * Verifies: the search box filters the listed modules.
   * Interacts with: applyFilter() on the MatTableDataSource.
   * Data: search "we".
   */
  it('filters the modules by the search text', async () => {
    const { user } = await renderModuleList();

    await user.type(screen.getByPlaceholderText('Search'), 'we');

    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.queryByText('db')).not.toBeInTheDocument();
  });
});
