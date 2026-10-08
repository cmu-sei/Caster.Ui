// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { A11yModule } from '@angular/cdk/a11y';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Directory } from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DirectoryEditComponent } from './directory-edit.component';

const directory: Directory = {
  id: 'dir1',
  name: 'network',
  projectId: 'p1',
  terraformVersion: '1.5.7',
  parallelism: 4,
  azureDestroyFailureThreshold: 3,
  azureDestroyFailureThresholdEnabled: true,
};

async function renderDirectoryEdit() {
  const updateDirectory = vi.fn<(d: Partial<Directory> | null) => void>();
  const { dialogRef } = dialogRefStub<DirectoryEditComponent>();
  const view = await renderComponent(DirectoryEditComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      A11yModule,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      MatCheckboxModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
    ],
    providers: [{ provide: MatDialogRef, useValue: dialogRef }],
    inputs: {
      directory,
      terraformVersions: {
        versions: ['0.12.29', '1.5.7', '1.10.0'],
        defaultVersion: '1.5.7',
      },
      maxParallelism: 10,
    },
    on: { updateDirectory },
  });
  return { ...view, updateDirectory, user: userEvent.setup() };
}

describe('DirectoryEditComponent', () => {
  /**
   * Verifies: the form opens with the directory's values and Save disabled until something changes.
   * Interacts with: the crucible-dialog submit button bound to submitDisabled.
   * Data: directory network, parallelism 4, Azure threshold 3 enabled.
   */
  it('opens with the directory values', async () => {
    await renderDirectoryEdit();

    expect(screen.getByPlaceholderText('Name')).toHaveValue('network');
    expect(screen.getByLabelText('Parallelism')).toHaveValue(4);
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: the Terraform versions are offered newest first, with the default marked.
   * Interacts with: the sorted versions in the Terraform Version select.
   * Data: versions 0.12.29, 1.5.7 (default) and 1.10.0.
   */
  it('lists the Terraform versions newest first', async () => {
    const { user } = await renderDirectoryEdit();

    await user.click(
      screen.getByRole('combobox', { name: 'Terraform Version' }),
    );

    expect(
      screen.getAllByRole('option').map((o) => o.textContent?.trim()),
    ).toEqual(['1.10.0', '1.5.7 (Default)', '0.12.29']);
  });

  /**
   * Verifies: Save emits only the fields the user changed.
   * Interacts with: the updateDirectory output.
   * Data: name changed to core.
   */
  it('saves only the changed fields', async () => {
    const { updateDirectory, user } = await renderDirectoryEdit();

    const name = screen.getByPlaceholderText('Name');
    await user.clear(name);
    await user.type(name, 'core');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateDirectory).toHaveBeenCalledWith({ name: 'core' });
  });

  /**
   * Verifies: a parallelism above the maximum and an Azure threshold of 0 show their range errors and keep Save disabled.
   * Interacts with: the min/max attributes on the number inputs (Angular's MinValidator and MaxValidator).
   * Data: parallelism 11 with maxParallelism 10; threshold 0.
   */
  it('rejects an out-of-range parallelism and Azure threshold', async () => {
    const { user } = await renderDirectoryEdit();

    const parallelism = screen.getByLabelText('Parallelism');
    await user.clear(parallelism);
    await user.type(parallelism, '11');
    const threshold = screen.getByLabelText('Azure Threshold');
    await user.clear(threshold);
    await user.type(threshold, '0');
    await user.tab();

    expect(screen.getAllByText(/Must be between 1 and 10/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
