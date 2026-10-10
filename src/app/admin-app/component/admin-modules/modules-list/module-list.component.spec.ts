// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ClipboardModule } from 'ngx-clipboard';
import { Module } from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminModuleListComponent } from './module-list.component';

const modules: Module[] = [
  { id: 'mod1', name: 'vm', path: 'group/vm', versionsCount: 2 },
];

async function renderModuleList(canEdit: boolean, confirmAnswer?: boolean) {
  const load = vi.fn<(all: boolean) => void>();
  const loadModuleById = vi.fn<(id: string) => void>();
  const deleteModule = vi.fn<(id: string) => void>();
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(AdminModuleListComponent, {
    imports: [
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatPaginatorModule,
      MatTableModule,
      MatSortModule,
      MatTooltipModule,
      MatCardModule,
      MatProgressSpinnerModule,
      ClipboardModule,
    ],
    providers: [
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { modules, isLoading: false, canEdit },
    on: { load, loadModuleById, delete: deleteModule },
  });
  return {
    ...view,
    load,
    loadModuleById,
    deleteModule,
    user: userEvent.setup(),
  };
}

describe('AdminModuleListComponent', () => {
  /**
   * Verifies: with canEdit the repository controls render, and an entered module id is emitted for add/update.
   * Interacts with: the loadModuleById output.
   * Data: canEdit true; external module id 42 typed in.
   */
  it('adds a module from the repository when canEdit is true', async () => {
    const { loadModuleById, user } = await renderModuleList(true);

    await user.type(screen.getByPlaceholderText('External Module ID'), '42');
    await user.click(
      screen.getByRole('button', {
        name: 'Add/Update this module from the repository',
      }),
    );

    expect(loadModuleById).toHaveBeenCalledWith('42');
  });

  /**
   * Verifies: with canEdit the Update ALL button emits load.
   * Interacts with: the load output.
   * Data: canEdit true.
   */
  it('updates all modules when canEdit is true', async () => {
    const { load, user } = await renderModuleList(true);

    await user.click(
      screen.getByRole('button', {
        name: 'Add/Update ALL from the repository',
      }),
    );

    expect(load).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: with canEdit, deleting a module asks for confirmation and emits its id once confirmed.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), the delete output.
   * Data: canEdit true; module mod1.
   */
  it('deletes a module after confirmation when canEdit is true', async () => {
    const { deleteModule, user } = await renderModuleList(true, true);

    await user.click(
      within(screen.getByRole('table')).getByRole('button', {
        name: 'Delete Module',
      }),
    );

    expect(deleteModule).toHaveBeenCalledWith('mod1');
  });

  /**
   * Verifies: without canEdit the repository controls and the Delete buttons are not rendered, while the modules are listed.
   * Interacts with: the @if (canEdit) blocks in the template.
   * Data: canEdit false; module vm.
   */
  it('hides the repository and delete controls when canEdit is false', async () => {
    await renderModuleList(false);

    expect(
      within(screen.getByRole('table')).getByText('group/vm'),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('External Module ID'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Add/Update ALL from the repository',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Module' }),
    ).not.toBeInTheDocument();
  });
});
