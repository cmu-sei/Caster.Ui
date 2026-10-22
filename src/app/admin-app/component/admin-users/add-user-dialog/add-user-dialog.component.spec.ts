// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { A11yModule } from '@angular/cdk/a11y';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { SystemRole } from 'src/app/generated/caster-api';
import { RoleService } from 'src/app/roles/roles.service.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { AddUserDialogComponent } from './add-user-dialog.component';

const validGuid = '3f0b1a52-9c4d-4e7f-8a1b-2c3d4e5f6a7b';

async function renderAddUserDialog(overrides: { roles?: SystemRole[] } = {}) {
  const { roles = [{ id: 'role-1', name: 'Administrator' }] } = overrides;
  const { dialogRef, close } = dialogRefStub<AddUserDialogComponent>();

  const rendered = await renderComponent(AddUserDialogComponent, {
    declarations: [AddUserDialogComponent],
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      A11yModule,
    ],
    providers: [{ provide: MatDialogRef, useValue: dialogRef }],
  });
  // The real RoleService. The dialog only reads roles$; UserListComponent loads
  // them through getRoles() before opening it, so seed the subject directly.
  TestBed.inject(RoleService).rolesSubject.next(roles);
  rendered.fixture.detectChanges();

  return { ...rendered, close, user: userEvent.setup() };
}

describe('AddUserDialogComponent', () => {
  /**
   * Verifies: the Create button starts disabled, because the empty form is
   *   invalid and pristine.
   * Interacts with: the <crucible-dialog> primary button bound to submitDisabled.
   * Data: no input.
   */
  it('disables Create until the form is filled in', async () => {
    await renderAddUserDialog();

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  /**
   * Verifies: a User ID that is not a GUID shows the pattern error once the
   *   field is touched, and Create stays disabled.
   * Interacts with: the User ID input; the Validators.pattern(Guid) mat-error.
   * Data: id 'not-a-guid', a valid name.
   */
  it('rejects a User ID that is not a GUID', async () => {
    const { user } = await renderAddUserDialog();

    await user.type(screen.getByLabelText('User ID'), 'not-a-guid');
    await user.type(screen.getByLabelText('Name'), 'Test User');

    expect(
      screen.getByText(/User ID must be a valid GUID/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  /**
   * Verifies: a Name shorter than 4 characters shows the minlength error once
   *   the field is touched, and Create stays disabled.
   * Interacts with: the Name input; the Validators.minLength(4) mat-error.
   * Data: a valid GUID id, name 'abc'.
   */
  it('rejects a Name shorter than 4 characters', async () => {
    const { user } = await renderAddUserDialog();

    await user.type(screen.getByLabelText('User ID'), validGuid);
    await user.type(screen.getByLabelText('Name'), 'abc');
    await user.tab();

    expect(
      screen.getByText(/Name must have a minimum of 4 characters/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  /**
   * Verifies: clearing a touched required field shows its required message.
   * Interacts with: the Name input; the Validators.required mat-error.
   * Data: name typed then cleared.
   */
  it('shows the required message for a cleared Name', async () => {
    const { user } = await renderAddUserDialog();

    const name = screen.getByLabelText('Name');
    await user.type(name, 'Test User');
    await user.clear(name);
    await user.tab();

    expect(screen.getByText(/Name is required/)).toBeInTheDocument();
  });

  /**
   * Verifies: a GUID id plus a 4+ character name enables Create.
   * Interacts with: both inputs; submitDisabled on <crucible-dialog>.
   * Data: a valid GUID, name 'Test'.
   */
  it('enables Create for a GUID id and a 4 character name', async () => {
    const { user } = await renderAddUserDialog();

    await user.type(screen.getByLabelText('User ID'), validGuid);
    await user.type(screen.getByLabelText('Name'), 'Test');

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  /**
   * Verifies: submitting without picking a role closes the dialog with the new
   *   user and a null roleId (the "None Locally" option's '' becomes null).
   * Interacts with: the Create button -> form ngSubmit -> onSubmit ->
   *   MatDialogRef.close.
   * Data: a valid GUID, name 'Test User', role left at its default.
   */
  it('closes with the new user and a null roleId when no role is picked', async () => {
    const { user, close } = await renderAddUserDialog();

    await user.type(screen.getByLabelText('User ID'), validGuid);
    await user.type(screen.getByLabelText('Name'), 'Test User');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith({
      id: validGuid,
      name: 'Test User',
      roleId: null,
    });
  });

  /**
   * Verifies: the Role select lists "None Locally" plus every role from
   *   RoleService, and submitting closes with the picked role's id.
   * Interacts with: MatSelectHarness on the Role select; RoleService.roles$ (real, seeded);
   *   MatDialogRef.close.
   * Data: one role { id: 'role-1', name: 'Administrator' }.
   */
  it('closes with the picked role id', async () => {
    const { fixture, user, close } = await renderAddUserDialog();
    const select =
      await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatSelectHarness,
      );

    await user.type(screen.getByLabelText('User ID'), validGuid);
    await user.type(screen.getByLabelText('Name'), 'Test User');
    await select.open();
    const options = await select.getOptions();
    expect(await Promise.all(options.map((o) => o.getText()))).toEqual([
      'None Locally',
      'Administrator',
    ]);
    await select.clickOptions({ text: 'Administrator' });
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(close).toHaveBeenCalledWith({
      id: validGuid,
      name: 'Test User',
      roleId: 'role-1',
    });
  });

  /**
   * Verifies: Cancel closes the dialog with no result.
   * Interacts with: the <crucible-dialog> Cancel button -> MatDialogRef.close.
   * Data: no input.
   */
  it('closes without a result on Cancel', async () => {
    const { user, close } = await renderAddUserDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith();
  });
});
