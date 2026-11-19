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

// One required variable with no default, beside the optional one.
const requiredModule: Module = {
  ...module,
  versions: [
    {
      ...module.versions[0],
      variables: [
        ...module.versions[0].variables,
        { name: 'image', variableType: 'string', isOptional: false },
      ],
    },
  ],
};

interface Inputs {
  selectedModule?: Module;
  name?: string;
  submitButtonText?: string;
  requireChanges?: boolean;
  requireValues?: boolean;
}

async function renderModuleVariables(
  readOnly: boolean,
  values: ModuleValue[] = [],
  inputs: Inputs = {},
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
    inputs: {
      selectedModule: module,
      name: 'web1',
      readOnly,
      values,
      ...inputs,
    },
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

  /**
   * Verifies: by default the submit button stays disabled until a field changes, and with requireChanges false it is enabled on an untouched form.
   * Interacts with: the submit button's (requireChanges && !form.dirty) binding.
   * Data: module web v1 with optional variable size; not read-only; requireChanges true, then false.
   */
  it.each([
    { requireChanges: true, disabled: true },
    { requireChanges: false, disabled: false },
  ])(
    "sets an untouched form's Save disabled to $disabled when requireChanges is $requireChanges",
    async ({ requireChanges, disabled }) => {
      await renderModuleVariables(false, [], { requireChanges });

      expect(
        (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
          .disabled,
      ).toBe(disabled);
    },
  );

  /**
   * Verifies: Insert with requireChanges false submits the module as it is, with no changed variables.
   * Interacts with: the variablesSelected output.
   * Data: module web v1 with optional variable size (default small); submitButtonText Insert; requireChanges false; nothing edited.
   */
  it('inserts an unchanged module when requireChanges is false', async () => {
    const { variablesSelected, user } = await renderModuleVariables(false, [], {
      submitButtonText: 'Insert',
      requireChanges: false,
    });

    await user.click(screen.getByRole('button', { name: 'Insert' }));

    expect(variablesSelected).toHaveBeenCalledWith({
      versionId: 'ver1',
      moduleName: 'web1',
      variableValues: [{ name: 'size', value: 'small' }],
      versionName: 'v1',
      changedVariables: [],
    });
  });

  /**
   * Verifies: in read-only mode Insert stays disabled even when no change is required, the case of the file editor outside edit mode.
   * Interacts with: the submit button's readOnly term.
   * Data: module web v1 with optional variable size (default small); submitButtonText Insert; requireChanges false; readOnly true.
   */
  it('disables Insert in read-only mode when no change is required', async () => {
    await renderModuleVariables(true, [], {
      submitButtonText: 'Insert',
      requireChanges: false,
    });

    expect(screen.getByRole('button', { name: 'Insert' })).toBeDisabled();
  });

  /**
   * Verifies: with requireValues a blank required variable keeps the submit button disabled and shows Required once left; without it the button is enabled.
   * Interacts with: the required validator createValuesForm adds, the submit button binding, mat-error.
   * Data: module web v1 with optional size and required image (no default); requireChanges false; requireValues true, then false.
   */
  it.each([
    { requireValues: true, disabled: true },
    { requireValues: false, disabled: false },
  ])(
    'sets Save disabled to $disabled for a blank required value when requireValues is $requireValues',
    async ({ requireValues, disabled }) => {
      const { user } = await renderModuleVariables(false, [], {
        selectedModule: requiredModule,
        requireChanges: false,
        requireValues,
      });

      await user.click(screen.getByPlaceholderText('image'));
      await user.tab();

      expect(
        (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
          .disabled,
      ).toBe(disabled);
      const errors = Array.from(document.querySelectorAll('mat-error')).map(
        (e) => e.textContent?.trim(),
      );
      expect(errors).toEqual(requireValues ? ['Required'] : []);
    },
  );

  /**
   * Verifies: a saved instance name that Terraform rejects shows its error at once and disables the submit button.
   * Interacts with: the TerraformName pattern validator on newName, markAsTouched in createForm, mat-error.
   * Data: module web v1; name "web server"; requireChanges false.
   */
  it('flags an instance name Terraform rejects', async () => {
    await renderModuleVariables(false, [], {
      name: 'web server',
      requireChanges: false,
    });

    expect(
      screen.getByText(
        'Must start with a letter or _, then letters, numbers, - and _ only',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: without a name input the instance name defaults to the module name made Terraform-safe.
   * Interacts with: toTerraformName in ngOnInit, the newName control.
   * Data: module "Router / Gateway"; no name input.
   */
  it('defaults the instance name to a Terraform-safe module name', async () => {
    await renderModuleVariables(false, [], {
      selectedModule: { ...module, name: 'Router / Gateway' },
      name: undefined,
    });

    expect(
      screen.getByPlaceholderText('Name of this module instance'),
    ).toHaveValue('Router_Gateway');
    expect(
      screen.queryByText(
        'Must start with a letter or _, then letters, numbers, - and _ only',
      ),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: when the name input is cleared on an untouched form, the instance name falls back to the module name made Terraform-safe.
   * Interacts with: ngOnChanges and onNameChanged, toTerraformName, the newName control.
   * Data: module "Router / Gateway" named r1; the name input then set to null.
   */
  it('falls back to a Terraform-safe module name when the name input is cleared', async () => {
    const { fixture } = await renderModuleVariables(false, [], {
      selectedModule: { ...module, name: 'Router / Gateway' },
    });
    const name = screen.getByPlaceholderText('Name of this module instance');
    expect(name).toHaveValue('web1');

    fixture.componentRef.setInput('name', null);
    fixture.detectChanges();

    expect(name).toHaveValue('Router_Gateway');
  });
});
