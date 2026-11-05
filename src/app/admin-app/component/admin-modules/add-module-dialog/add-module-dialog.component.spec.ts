// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { A11yModule } from '@angular/cdk/a11y';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { renderComponent } from 'src/app/test-utils/render-component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { AddModuleDialogComponent } from './add-module-dialog.component';

async function renderDialog() {
  const { dialogRef, close } = dialogRefStub<AddModuleDialogComponent>();
  const view = await renderComponent(AddModuleDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatFormFieldModule,
      MatInputModule,
      A11yModule,
    ],
    providers: [{ provide: MatDialogRef, useValue: dialogRef }],
  });
  return { ...view, close, user: userEvent.setup() };
}

describe('AddModuleDialogComponent', () => {
  /**
   * Verifies: Add stays disabled until something is entered, and blank input does not count.
   * Interacts with: the <crucible-dialog> primary button bound to submitDisabled.
   * Data: nothing, then spaces.
   */
  it('disables Add until an External Module ID is entered', async () => {
    const { user } = await renderDialog();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await user.type(screen.getByLabelText('External Module ID'), '   ');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  /**
   * Verifies: the field says what it takes, as the old box's tooltip did.
   * Interacts with: mat-hint.
   * Data: none.
   */
  it('explains the three forms the ID can take', async () => {
    await renderDialog();

    expect(
      screen.getByText(/name\/subdirectory for one module in it/),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: Add closes the dialog with the entered ID, trimmed, in each form.
   * Interacts with: the Add button, MatDialogRef.close (stub).
   * Data: a source name, a source/subdirectory, a GitLab project ID.
   */
  it.each(['proxmox', 'proxmox/vm', '42'])(
    'closes with %s',
    async (value) => {
      const { close, user } = await renderDialog();

      await user.type(screen.getByLabelText('External Module ID'), ' ' + value + ' ');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(close).toHaveBeenCalledWith(value);
    },
  );
});
