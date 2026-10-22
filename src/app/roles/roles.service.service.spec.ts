// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  SystemPermission,
  SystemRole,
  SystemRolesService,
} from '../generated/caster-api';
import { ApiStub } from '../test-utils/api-stub';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { recordEmissions } from '../test-utils/record-emissions';
import { RoleService } from './roles.service.service';

function role(overrides: Partial<SystemRole> = {}): SystemRole {
  return {
    id: 'r1',
    name: 'Content Developer',
    allPermissions: false,
    immutable: false,
    permissions: [SystemPermission.CreateProjects],
    ...overrides,
  };
}

/** The real BehaviorSubject-backed RoleService; SystemRolesService stubbed. */
function setup(api: ApiStub<SystemRolesService>) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: SystemRolesService, useValue: api },
    ]),
  });
  return TestBed.inject(RoleService);
}

describe('RoleService', () => {
  /**
   * Verifies: getRoles publishes the API's roles on roles$.
   * Interacts with: SystemRolesService.getAllSystemRoles (stub).
   * Data: the API returns r1 and r2.
   */
  it('getRoles() publishes the system roles', async () => {
    const api = {
      getAllSystemRoles: vi.fn(() =>
        of([role(), role({ id: 'r2', name: 'Administrator' })]),
      ),
    } satisfies ApiStub<SystemRolesService>;
    const service = setup(api);
    const seen = recordEmissions(service.roles$);

    await firstValueFrom(service.getRoles());

    expect(seen.map((rs) => rs.map((r) => r.id))).toEqual([[], ['r1', 'r2']]);
  });

  /**
   * Verifies: createRole appends the created role, editRole merges the
   *   response into the role with the edited id, and deleteRole removes it.
   * Interacts with: SystemRolesService create/edit/delete (stubs).
   * Data: loaded r1; create r2; edit r1's permissions; delete r2.
   */
  it('createRole(), editRole() and deleteRole() update roles$', async () => {
    const edited = role({ permissions: [SystemPermission.ViewProjects] });
    const api = {
      getAllSystemRoles: vi.fn(() => of([role()])),
      createSystemRole: vi.fn(() => of(role({ id: 'r2', name: 'Observer' }))),
      editSystemRole: vi.fn(() => of(edited)),
      deleteSystemRole: vi.fn(() => of(undefined)),
    } satisfies ApiStub<SystemRolesService>;
    const service = setup(api);
    await firstValueFrom(service.getRoles());

    await firstValueFrom(
      service.createRole(role({ id: undefined, name: 'Observer' })),
    );
    await firstValueFrom(service.editRole(edited));
    expect(await firstValueFrom(service.roles$)).toEqual([
      edited,
      role({ id: 'r2', name: 'Observer' }),
    ]);
    await firstValueFrom(service.deleteRole('r2'));

    expect(api.editSystemRole).toHaveBeenCalledWith('r1', edited);
    expect(api.deleteSystemRole).toHaveBeenCalledWith('r2');
    expect(await firstValueFrom(service.roles$)).toEqual([edited]);
  });

  /**
   * Verifies: a failed deleteRole passes the API error to the subscriber and
   *   keeps the role in roles$.
   * Interacts with: SystemRolesService.getAllSystemRoles (stub),
   *   deleteSystemRole (stub, failing).
   * Data: loaded r1; deleting r1 fails with a 409 (role still assigned).
   */
  it('keeps the role when deleteRole() fails', async () => {
    const conflict = new Error('409 Conflict');
    const api = {
      getAllSystemRoles: vi.fn(() => of([role()])),
      deleteSystemRole: vi.fn(() => throwError(() => conflict)),
    } satisfies ApiStub<SystemRolesService>;
    const service = setup(api);
    await firstValueFrom(service.getRoles());

    await expect(firstValueFrom(service.deleteRole('r1'))).rejects.toBe(
      conflict,
    );

    expect(await firstValueFrom(service.roles$)).toEqual([role()]);
  });
});
