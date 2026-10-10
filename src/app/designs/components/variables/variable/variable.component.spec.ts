// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ClipboardModule } from 'ngx-clipboard';
import {
  Variable,
  VariablesService,
  VariableType,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VariableComponent } from './variable.component';

const variable: Variable = {
  id: 'v1',
  designId: 'd1',
  name: 'region',
  type: VariableType.String,
  defaultValue: 'east',
};

async function renderVariable(canEdit: boolean, confirmAnswer?: boolean) {
  const variablesApi = {
    editVariable: vi.fn((id: string) => of<Variable>({ ...variable, id })),
    deleteVariable: vi.fn((_id: string) => of<unknown>(null)),
  } satisfies ApiStub<VariablesService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(VariableComponent, {
    imports: [
      MatCardModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      ClipboardModule,
    ],
    providers: [
      { provide: VariablesService, useValue: variablesApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { variable, canEdit },
  });
  return { ...view, variablesApi, user: userEvent.setup() };
}

describe('VariableComponent', () => {
  /**
   * Verifies: with canEdit the edit form is writable, and saving sends the edited name with the other fields.
   * Interacts with: VariablesService.editVariable (stub), real VariableService.
   * Data: variable region (string, default east) renamed to zone; canEdit true.
   */
  it('saves an edited variable when canEdit is true', async () => {
    const { variablesApi, user } = await renderVariable(true);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toBeEnabled();
    await user.clear(name);
    await user.type(name, 'zone');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(variablesApi.editVariable).toHaveBeenCalledWith('v1', {
      name: 'zone',
      type: VariableType.String,
      defaultValue: 'east',
    });
  });

  /**
   * Verifies: with canEdit, Delete asks for confirmation and deletes the variable.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), VariablesService.deleteVariable (stub).
   * Data: variable region; canEdit true.
   */
  it('deletes the variable after confirmation when canEdit is true', async () => {
    const { variablesApi, user } = await renderVariable(true, true);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(variablesApi.deleteVariable).toHaveBeenCalledWith('v1');
  });

  /**
   * Verifies: without canEdit Delete is disabled and the opened edit form is read-only, with Save disabled.
   * Interacts with: the canEdit-disabled form controls and the [disabled] bindings.
   * Data: variable region; canEdit false.
   */
  it('shows the variable read-only when canEdit is false', async () => {
    const { user } = await renderVariable(false);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
