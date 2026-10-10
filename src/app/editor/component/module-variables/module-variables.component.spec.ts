// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { A11yModule } from '@angular/cdk/a11y';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Module, ModuleValue } from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ModuleVariablesComponent } from './module-variables.component';
import { ModuleVariablesResult } from './module-variables.models';

const module: Module = {
  id: 'mod1',
  name: 'web',
  path: 'g/web',
  versions: [
    {
      id: 'ver1',
      name: 'v1',
      variables: [
        {
          name: 'size',
          variableType: 'string',
          defaultValue: 'small',
          isOptional: true,
        },
      ],
    },
  ],
};

async function renderModuleVariables(
  readOnly: boolean,
  values: ModuleValue[] = [],
) {
  const variablesSelected = vi.fn<(r: ModuleVariablesResult | null) => void>();
  const { dialogRef } = dialogRefStub<ModuleVariablesComponent>();
  const view = await renderComponent(ModuleVariablesComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      A11yModule,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      MatCardModule,
      MatAutocompleteModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
    ],
    providers: [{ provide: MatDialogRef, useValue: dialogRef }],
    inputs: { selectedModule: module, name: 'web1', readOnly, values },
    on: { variablesSelected },
  });
  return { ...view, variablesSelected, user: userEvent.setup() };
}

describe('ModuleVariablesComponent', () => {
  /**
   * Verifies: the form shows the instance name and each variable with its stored value, and Save emits the edited values with the changed variable named.
   * Interacts with: the variablesSelected output.
   * Data: module web v1 with optional variable size (stored value medium) changed to large; not read-only.
   */
  it('emits the edited variable values', async () => {
    const { variablesSelected, user } = await renderModuleVariables(false, [
      { name: 'size', value: 'medium' },
    ]);

    expect(
      screen.getByPlaceholderText('Name of this module instance'),
    ).toHaveValue('web1');
    const size = screen.getByPlaceholderText('size');
    expect(size).toHaveValue('medium');
    await user.clear(size);
    await user.type(size, 'large');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(variablesSelected).toHaveBeenCalledWith({
      versionId: 'ver1',
      moduleName: 'web1',
      variableValues: [{ name: 'size', value: 'large' }],
      versionName: 'v1',
      changedVariables: ['size'],
    });
  });

  /**
   * Verifies: read-only mode disables the name and variable inputs and the Save button.
   * Interacts with: the readOnly-disabled form controls and the submit button binding.
   * Data: module web v1; readOnly true.
   */
  it('disables editing in read-only mode', async () => {
    await renderModuleVariables(true);

    expect(
      screen.getByPlaceholderText('Name of this module instance'),
    ).toBeDisabled();
    expect(screen.getByPlaceholderText('size')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
