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
  maxVcpu: 32,
  terraformVersion: '1.5.7',
  parallelism: 4,
  azureDestroyFailureThreshold: 2,
  runs: [],
};

async function renderWorkspaceEdit(canEditLimits = false) {
  const updateWorkspace = vi.fn<(w: Partial<Workspace> | null) => void>();
  const updateLimits = vi.fn();
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
      canEditLimits,
    },
    on: { updateWorkspace, updateLimits },
  });
  return { ...view, updateWorkspace, updateLimits, user: userEvent.setup() };
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

  /**
   * Verifies: without EditProjects the deployment limit fields are not shown.
   * Interacts with: the canEditLimits input.
   * Data: workspace dev with a vCPU limit of 32; canEditLimits false.
   */
  it('hides the deployment limits from a caller who cannot set them', async () => {
    await renderWorkspaceEdit(false);

    expect(screen.queryByLabelText('Max vCPU')).toBeNull();
  });

  /**
   * Verifies: an admin sees the workspace's limits, and Save emits the changed limits apart from the workspace fields, an emptied field as no limit.
   * Interacts with: the updateLimits and updateWorkspace outputs.
   * Data: workspace dev with a vCPU limit of 32; max machines set to 10, max vCPU emptied.
   */
  it('saves changed deployment limits for an admin', async () => {
    const { updateLimits, updateWorkspace, user } =
      await renderWorkspaceEdit(true);

    expect(screen.getByLabelText('Max vCPU')).toHaveValue(32);
    await user.type(screen.getByLabelText('Max machines'), '10');
    await user.clear(screen.getByLabelText('Max vCPU'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateLimits).toHaveBeenCalledWith({
      maxMachines: 10,
      maxVcpu: null,
      maxMemoryGiB: null,
      maxDiskGiB: null,
    });
    expect(updateWorkspace).toHaveBeenCalledWith({});
  });

  /**
   * Verifies: a negative limit is refused and keeps Save disabled.
   * Interacts with: the min validator on each limit.
   * Data: max disk -5.
   */
  it('refuses a negative limit', async () => {
    const { user } = await renderWorkspaceEdit(true);

    await user.type(screen.getByLabelText('Max disk (GiB)'), '-5');
    await user.tab();

    expect(screen.getByText('A whole number from 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
