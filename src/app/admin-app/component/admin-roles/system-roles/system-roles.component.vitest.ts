// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { SystemPermission, SystemRole } from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import { RoleService } from 'src/app/roles/roles.service.service';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { SystemRolesComponent } from './system-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';

function makeRole(overrides: Partial<SystemRole> = {}): SystemRole {
  return {
    id: 'r1',
    name: 'Role',
    immutable: false,
    allPermissions: false,
    permissions: [],
    ...overrides,
  } as SystemRole;
}

async function renderRoles(
  overrides: {
    roles?: SystemRole[];
    confirmCancel?: boolean;
    nameDialogCancel?: boolean;
    nameValue?: string;
  } = {},
) {
  const {
    roles = [makeRole()],
    confirmCancel = false,
    nameDialogCancel = false,
    nameValue = 'New',
  } = overrides;

  const getRoles = vi.fn(() => of(roles));
  const createRole = vi.fn(() => of({}));
  const editRole = vi.fn(() => of({}));
  const deleteRole = vi.fn(() => of({}));
  const confirmDialog = vi.fn(() => of({ wasCancelled: confirmCancel }));
  const dialogOpen = vi.fn(() => ({
    componentInstance: { title: '', message: '' },
    afterClosed: () =>
      of({ wasCancelled: nameDialogCancel, nameValue }),
  }));

  const rendered = await renderComponent(SystemRolesComponent, {
    declarations: [SystemRolesComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      {
        provide: RoleService,
        useValue: { roles$: of(roles), getRoles, createRole, editRole, deleteRole },
      },
      { provide: MatDialog, useValue: { open: dialogOpen } },
      {
        provide: ConfirmDialogService,
        useValue: { confirmDialog, WAS_CANCELLED: 'wasCancelled' },
      },
      {
        provide: PermissionService,
        useValue: { hasPermission: () => of(true) },
      },
      {
        provide: SignalRService,
        useValue: {
          startConnection: vi.fn(() => Promise.resolve()),
          joinRolesAdmin: vi.fn(),
          leaveRolesAdmin: vi.fn(),
        },
      },
    ],
  });

  return { ...rendered, getRoles, createRole, editRole, deleteRole, confirmDialog, dialogOpen };
}

describe('SystemRolesComponent', () => {
  it('creates and calls getRoles on init', async () => {
    const { fixture, getRoles } = await renderRoles();
    expect(fixture.componentInstance).toBeTruthy();
    expect(getRoles).toHaveBeenCalled();
  });

  it('hasPermission returns true for "All" pseudo-permission when role.allPermissions=true', async () => {
    const { fixture } = await renderRoles();
    const role = makeRole({ allPermissions: true });
    expect(fixture.componentInstance.hasPermission('All', role)).toBe(true);
  });

  it('hasPermission returns true when role.permissions contains the value', async () => {
    const { fixture } = await renderRoles();
    const role = makeRole({
      permissions: [SystemPermission.ManageRoles as SystemPermission],
    });
    expect(
      fixture.componentInstance.hasPermission(
        SystemPermission.ManageRoles,
        role,
      ),
    ).toBe(true);
  });

  it('setPermission("All", checked) flips allPermissions and saves', async () => {
    const { fixture, editRole } = await renderRoles();
    const role = makeRole();
    fixture.componentInstance.setPermission('All', role, {
      checked: true,
    } as MatCheckboxChange);
    expect(role.allPermissions).toBe(true);
    expect(editRole).toHaveBeenCalledWith(role);
  });

  it('setPermission adds a specific permission when checked', async () => {
    const { fixture, editRole } = await renderRoles();
    const role = makeRole();
    fixture.componentInstance.setPermission(
      SystemPermission.ManageRoles,
      role,
      { checked: true } as MatCheckboxChange,
    );
    expect(role.permissions).toContain(SystemPermission.ManageRoles);
    expect(editRole).toHaveBeenCalled();
  });

  it('setPermission removes a specific permission when unchecked', async () => {
    const { fixture, editRole } = await renderRoles();
    const role = makeRole({
      permissions: [SystemPermission.ManageRoles as SystemPermission],
    });
    fixture.componentInstance.setPermission(
      SystemPermission.ManageRoles,
      role,
      { checked: false } as MatCheckboxChange,
    );
    expect(role.permissions).not.toContain(SystemPermission.ManageRoles);
    expect(editRole).toHaveBeenCalled();
  });

  it('addRole creates a role with the entered name when dialog is confirmed', async () => {
    const { fixture, createRole } = await renderRoles({
      nameDialogCancel: false,
      nameValue: 'My Role',
    });
    fixture.componentInstance.addRole();
    expect(createRole).toHaveBeenCalledWith({ name: 'My Role' });
  });

  it('addRole is a no-op when dialog is cancelled', async () => {
    const { fixture, createRole } = await renderRoles({ nameDialogCancel: true });
    fixture.componentInstance.addRole();
    expect(createRole).not.toHaveBeenCalled();
  });

  it('renameRole edits the role name when dialog is confirmed', async () => {
    const { fixture, editRole } = await renderRoles({
      nameDialogCancel: false,
      nameValue: 'Renamed',
    });
    const role = makeRole();
    fixture.componentInstance.renameRole(role);
    expect(role.name).toBe('Renamed');
    expect(editRole).toHaveBeenCalledWith(role);
  });

  it('deleteRole dispatches when confirm returns wasCancelled=false', async () => {
    const { fixture, deleteRole } = await renderRoles({ confirmCancel: false });
    fixture.componentInstance.deleteRole(makeRole({ id: 'r1' }));
    expect(deleteRole).toHaveBeenCalledWith('r1');
  });

  it('deleteRole is a no-op when confirm returns wasCancelled=true', async () => {
    const { fixture, deleteRole } = await renderRoles({ confirmCancel: true });
    fixture.componentInstance.deleteRole(makeRole());
    expect(deleteRole).not.toHaveBeenCalled();
  });

  it('trackById returns item id', async () => {
    const { fixture } = await renderRoles();
    expect(fixture.componentInstance.trackById(0, { id: 'x' })).toBe('x');
  });
});
