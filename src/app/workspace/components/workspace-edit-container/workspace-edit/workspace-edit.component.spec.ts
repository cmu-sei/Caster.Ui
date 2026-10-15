// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Workspace } from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { WorkspaceEditComponent } from './workspace-edit.component';

const workspace: Workspace = {
  id: 'w1',
  name: 'dev',
  terraformVersion: '1.5.7',
  parallelism: 4,
  azureDestroyFailureThreshold: 2,
  runs: [],
};

async function renderWorkspaceEdit() {
  const updateWorkspace = vi.fn<(w: Partial<Workspace> | null) => void>();
  const { dialogRef } = dialogRefStub<WorkspaceEditComponent>();
  const view = await renderComponent(WorkspaceEditComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      A11yModule,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
    ],
    providers: [{ provide: MatDialogRef, useValue: dialogRef }],
    inputs: {
      workspace,
      terraformVersions: {
        versions: ['1.5.7', '1.10.0'],
        defaultVersion: '1.5.7',
      },
      maxParallelism: 10,
    },
    on: { updateWorkspace },
  });
  return { ...view, updateWorkspace, user: userEvent.setup() };
}

describe('WorkspaceEditComponent', () => {
  /**
   * Verifies: the form opens with the workspace's values, and Save emits only the changed name.
   * Interacts with: the updateWorkspace output.
   * Data: workspace dev; name changed to staging.
   */
  it('saves only the changed fields', async () => {
    const { updateWorkspace, user } = await renderWorkspaceEdit();

    expect(screen.getByLabelText('Parallelism')).toHaveValue(4);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    const name = screen.getByPlaceholderText('Name');
    await user.clear(name);
    await user.type(name, 'staging');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateWorkspace).toHaveBeenCalledWith({ name: 'staging' });
  });

  /**
   * Verifies: a name with a character outside letters, numbers, -, _ and . shows the pattern error and keeps Save disabled.
   * Interacts with: the WorkspaceName pattern validator.
   * Data: name "my workspace" (a space).
   */
  it('rejects a name with a space', async () => {
    const { user } = await renderWorkspaceEdit();

    const name = screen.getByPlaceholderText('Name');
    await user.clear(name);
    await user.type(name, 'my workspace');
    await user.tab();

    expect(
      screen.getByText(/Letters, numbers, -, _, and . only/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: Cancel emits null.
   * Interacts with: the updateWorkspace output.
   * Data: none changed.
   */
  it('emits null on cancel', async () => {
    const { updateWorkspace, user } = await renderWorkspaceEdit();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateWorkspace).toHaveBeenCalledWith(null);
  });
});
