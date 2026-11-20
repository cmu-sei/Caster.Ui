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
import { GitlabProjectDialogComponent } from './gitlab-project-dialog.component';

async function renderDialog() {
  const { dialogRef, close } = dialogRefStub<GitlabProjectDialogComponent>();
  const view = await renderComponent(GitlabProjectDialogComponent, {
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

describe('GitlabProjectDialogComponent', () => {
  /**
   * Verifies: Sync stays disabled until a project ID is entered.
   * Interacts with: the <crucible-dialog> primary button bound to submitDisabled.
   * Data: no input.
   */
  it('disables Sync until a project ID is entered', async () => {
    await renderDialog();

    expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled();
  });

  /**
   * Verifies: an ID that is not a number shows an error and cannot be submitted.
   * Interacts with: the projectId pattern validator, mat-error.
   * Data: "group/project" typed.
   */
  it('rejects a project ID that is not a number', async () => {
    const { user } = await renderDialog();

    await user.type(
      screen.getByLabelText('GitLab Project ID'),
      'group/project',
    );
    await user.tab();

    expect(
      screen.getByText('GitLab Project ID must be a number.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled();
  });

  /**
   * Verifies: Sync closes the dialog with the entered ID, trimmed.
   * Interacts with: the Sync button, MatDialogRef.close (stub).
   * Data: " 42 " typed.
   */
  it('closes with the entered project ID', async () => {
    const { close, user } = await renderDialog();

    await user.type(screen.getByLabelText('GitLab Project ID'), ' 42 ');
    await user.click(screen.getByRole('button', { name: 'Sync' }));

    expect(close).toHaveBeenCalledWith('42');
  });
});
