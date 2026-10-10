// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  SystemPermission,
  SystemRole,
  SystemRolesService,
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SystemRolesComponent } from './system-roles.component';

function roles(): SystemRole[] {
  return [
    {
      id: 'r1',
      name: 'Administrator',
      allPermissions: true,
      immutable: true,
      permissions: [],
    },
    {
      id: 'r2',
      name: 'Observer',
      allPermissions: false,
      immutable: false,
      permissions: [SystemPermission.ViewProjects],
    },
  ];
}

async function renderSystemRoles(grants: PermissionGrants) {
  const rolesApi = {
    getAllSystemRoles: vi.fn(() => of<SystemRole[]>(roles())),
    editSystemRole: vi.fn((_id: string, role: SystemRole) =>
      of<SystemRole>(structuredClone(role)),
    ),
  } satisfies ApiStub<SystemRolesService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinRolesAdmin: vi.fn(),
    leaveRolesAdmin: vi.fn(),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'joinRolesAdmin' | 'leaveRolesAdmin'
  >;
  const view = await renderComponent(SystemRolesComponent, {
    imports: [
      MatTableModule,
      MatCheckboxModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatDialogModule,
    ],
    providers: [
      ...permissionDataProviders(grants),
      { provide: SystemRolesService, useValue: rolesApi },
      { provide: SignalRService, useValue: signalR },
    ],
  });
  await view.fixture.whenStable();
  return { ...view, rolesApi, signalR, user: userEvent.setup() };
}

function permissionRow(permission: string): HTMLElement {
  return within(screen.getByRole('table'))
    .getByRole('button', { name: `About ${permission}` })
    .closest('tr') as HTMLElement;
}

describe('SystemRolesComponent', () => {
  /**
   * Verifies: with ManageRoles the mutable role gets Rename and Delete buttons and enabled checkboxes, and Add New Role is enabled; the immutable role stays locked.
   * Interacts with: PermissionService.hasPermission (real), SystemRolesService.getAllSystemRoles (stub), SignalRService.joinRolesAdmin (stub).
   * Data: system permission ManageRoles; roles Administrator (immutable) and Observer.
   */
  it('lets a role manager edit the mutable roles', async () => {
    const { signalR } = await renderSystemRoles({
      system: [SystemPermission.ManageRoles],
    });

    expect(signalR.joinRolesAdmin).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add New Role' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Rename role Observer' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete role Observer' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete role Administrator' }),
    ).not.toBeInTheDocument();
    const [, observerBox] = within(permissionRow('All')).getAllByRole(
      'checkbox',
    );
    expect(observerBox).toBeEnabled();
  });

  /**
   * Verifies: without ManageRoles Add New Role is disabled, no role has Rename or Delete, and every checkbox is disabled.
   * Interacts with: PermissionService.hasPermission (real).
   * Data: near miss: system permission ViewRoles only.
   */
  it('shows the roles read-only without ManageRoles', async () => {
    await renderSystemRoles({ system: [SystemPermission.ViewRoles] });

    expect(screen.getByRole('button', { name: 'Add New Role' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Rename role Observer' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete role Observer' }),
    ).not.toBeInTheDocument();
    for (const box of within(screen.getByRole('table')).getAllByRole(
      'checkbox',
    )) {
      expect(box).toBeDisabled();
    }
  });

  /**
   * Verifies: checking a permission on a mutable role saves the role with that permission added.
   * Interacts with: SystemRolesService.editSystemRole (stub), real RoleService.
   * Data: system permission ManageRoles; ViewUsers checked for Observer.
   */
  it('adds a permission to a role when its box is checked', async () => {
    const { rolesApi, user } = await renderSystemRoles({
      system: [SystemPermission.ManageRoles],
    });

    await user.click(
      within(permissionRow(SystemPermission.ViewUsers)).getByRole('checkbox'),
    );

    expect(rolesApi.editSystemRole).toHaveBeenCalledWith(
      'r2',
      expect.objectContaining({
        permissions: [
          SystemPermission.ViewProjects,
          SystemPermission.ViewUsers,
        ],
      }),
    );
  });
});
