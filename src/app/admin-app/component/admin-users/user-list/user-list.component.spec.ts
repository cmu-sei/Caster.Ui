// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ClipboardModule } from 'ngx-clipboard';
import {
  SystemRole,
  SystemRolesService,
  User,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserListComponent } from './user-list.component';

const users: User[] = [{ id: 'u1', name: 'Ada', roleId: null }];

async function renderUserList(canEdit: boolean, confirmAnswer?: boolean) {
  const deleteUser = vi.fn<(id: string) => void>();
  const rolesApi = {
    getAllSystemRoles: vi.fn(() =>
      of<SystemRole[]>([{ id: 'r1', name: 'Administrator' }]),
    ),
  } satisfies ApiStub<SystemRolesService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(UserListComponent, {
    imports: [
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      MatButtonModule,
      MatIconModule,
      MatPaginatorModule,
      MatTableModule,
      MatSortModule,
      MatCardModule,
      MatProgressSpinnerModule,
      MatDialogModule,
      ClipboardModule,
    ],
    providers: [
      { provide: SystemRolesService, useValue: rolesApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { users, isLoading: false, canEdit },
    on: { delete: deleteUser },
  });
  return { ...view, deleteUser, user: userEvent.setup() };
}

describe('UserListComponent', () => {
  /**
   * Verifies: with canEdit, Add User and the role select are enabled, and Delete emits the user id once confirmed.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), the delete output, real RoleService.
   * Data: user Ada; canEdit true.
   */
  it('lets an editor add, re-role and delete users when canEdit is true', async () => {
    const { deleteUser, user } = await renderUserList(true, true);
    const table = screen.getByRole('table');

    expect(
      within(table).getByRole('button', { name: 'Add User' }),
    ).toBeEnabled();
    expect(within(table).getByRole('combobox')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(
      within(table).getByRole('button', { name: 'Delete user Ada' }),
    );

    expect(deleteUser).toHaveBeenCalledWith('u1');
  });

  /**
   * Verifies: without canEdit Add User and the role select are disabled and no Delete button renders.
   * Interacts with: the canEdit bindings in the template.
   * Data: user Ada; canEdit false.
   */
  it('shows the users read-only when canEdit is false', async () => {
    await renderUserList(false);
    const table = screen.getByRole('table');

    expect(within(table).getByText('Ada')).toBeInTheDocument();
    expect(
      within(table).getByRole('button', { name: 'Add User' }),
    ).toBeDisabled();
    expect(within(table).getByRole('combobox')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      within(table).queryByRole('button', { name: 'Delete user Ada' }),
    ).not.toBeInTheDocument();
  });
});
