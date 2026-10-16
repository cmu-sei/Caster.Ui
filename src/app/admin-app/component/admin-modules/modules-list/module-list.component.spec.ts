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
  {
    id: 'mod1',
    name: 'vm',
    path: 'group/vm',
    description: 'A virtual machine',
    versionsCount: 2,
    latestVersion: 'v1.2.0',
  },
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
   * Verifies: with canEdit the repository controls render, the id field explains it takes a module source name (or name/subdirectory, or a GitLab project ID), and an entered id is emitted for add/update.
   * Interacts with: the id field's matTooltip, the loadModuleById output.
   * Data: canEdit true; external module id 42 typed in.
   */
  it('adds a module from the repository when canEdit is true', async () => {
    const { fixture, loadModuleById, user } = await renderModuleList(true);
    await fixture.whenStable();
    fixture.detectChanges();

    const id = screen.getByPlaceholderText('External Module ID');
    expect(id).toHaveAccessibleDescription(
      'A module source name, or name/subdirectory for one module in it. For a GitLab source, its project ID.',
    );
    await user.type(id, '42');
    await user.click(
      screen.getByRole('button', {
        name: 'Add/Update the Modules from this source',
      }),
    );

    expect(loadModuleById).toHaveBeenCalledWith('42');
  });

  /**
   * Verifies: with canEdit the every-source update button emits load(true).
   * Interacts with: the load output.
   * Data: canEdit true.
   */
  it('updates all modules when canEdit is true', async () => {
    const { load, user } = await renderModuleList(true);

    await user.click(
      screen.getByRole('button', {
        name: 'Add/Update the Modules from every source',
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
        name: 'Add/Update the Modules from every source',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Module' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: each module's description and latest version are listed, so an administrator can see what an import brought in.
   * Interacts with: the description and latestVersion columns.
   * Data: module vm, description "A virtual machine", latest version v1.2.0.
   */
  it('lists the description and latest version', async () => {
    await renderModuleList(false);

    const table = within(screen.getByRole('table'));
    expect(
      table.getByRole('columnheader', { name: 'Description' }),
    ).toBeInTheDocument();
    expect(
      table.getByRole('columnheader', { name: 'Latest Version' }),
    ).toBeInTheDocument();
    expect(table.getByText('A virtual machine')).toBeInTheDocument();
    expect(table.getByText('v1.2.0')).toBeInTheDocument();
  });
});
