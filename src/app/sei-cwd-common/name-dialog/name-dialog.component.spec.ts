// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { A11yModule } from '@angular/cdk/a11y';
import { Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { NameDialogComponent } from './name-dialog.component';

async function renderNameDialog(data: Record<string, unknown>) {
  const { dialogRef, close } = dialogRefStub<NameDialogComponent>();
  const view = await renderComponent(NameDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      A11yModule,
      MatFormFieldModule,
      MatInputModule,
    ],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
    componentProperties: { title: 'Rename' },
  });
  return { ...view, close, user: userEvent.setup() };
}

describe('NameDialogComponent', () => {
  /**
   * Verifies: Save is disabled until the name changes, then closes the dialog with the new name and description.
   * Interacts with: MatDialogRef.close (dialogRefStub).
   * Data: name web, description shown; name changed to api, description "API tier".
   */
  it('closes with the edited name and description', async () => {
    const { close, user } = await renderNameDialog({
      nameValue: 'web',
      showDescription: true,
      descriptionValue: '',
    });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'api');
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'API tier',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(close).toHaveBeenCalledWith(
      expect.objectContaining({
        nameValue: 'api',
        descriptionValue: 'API tier',
        removeArtifacts: false,
      }),
    );
  });

  /**
   * Verifies: a failing caller-supplied validator shows its message and keeps Save disabled.
   * Interacts with: data.validators added to the name control.
   * Data: a maxlength(3) validator named maxlength; name "toolong".
   */
  it('shows the message of a failing name validator', async () => {
    const { user } = await renderNameDialog({
      nameValue: '',
      validators: [
        {
          name: 'maxlength',
          validator: Validators.maxLength(3),
          errorMessage: 'At most 3 characters',
        },
      ],
    });

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'toolong');
    await user.tab();

    expect(screen.getByText('At most 3 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
