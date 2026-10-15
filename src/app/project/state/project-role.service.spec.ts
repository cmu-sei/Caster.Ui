// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  ProjectPermission,
  ProjectRole,
  ProjectRolesService,
} from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { recordEmissions } from '../../test-utils/record-emissions';
import { ProjectRoleService } from './project-role.service';

describe('ProjectRoleService', () => {
  /**
   * Verifies: projectRoles$ starts empty and loadRoles publishes the API's
   *   project roles.
   * Interacts with: ProjectRolesService.getAllProjectRoles (stub).
   * Data: the API returns Member and Manager roles.
   */
  it('loadRoles() publishes the project roles', async () => {
    const roles: ProjectRole[] = [
      {
        id: 'role-member',
        name: 'Member',
        permissions: [ProjectPermission.EditProject],
      },
      { id: 'role-manager', name: 'Manager', allPermissions: true },
    ];
    const api = {
      getAllProjectRoles: vi.fn(() => of(roles)),
    } satisfies ApiStub<ProjectRolesService>;
    TestBed.configureTestingModule({
      providers: getDefaultProviders([
        { provide: ProjectRolesService, useValue: api },
      ]),
    });
    const service = TestBed.inject(ProjectRoleService);
    const seen = recordEmissions(service.projectRoles$);

    expect(await firstValueFrom(service.loadRoles())).toBe(roles);

    expect(seen).toEqual([[], roles]);
  });

  /**
   * Verifies: a failed reload passes the API error to the subscriber and
   *   keeps the project roles loaded before.
   * Interacts with: ProjectRolesService.getAllProjectRoles (stub, succeeds,
   *   then fails).
   * Data: first load returns the Member role; the second fails with a 500.
   */
  it('keeps the loaded roles when loadRoles() fails', async () => {
    const roles: ProjectRole[] = [{ id: 'role-member', name: 'Member' }];
    const serverError = new Error('500 Internal Server Error');
    let fail = false;
    const api = {
      getAllProjectRoles: vi.fn(() =>
        fail ? throwError(() => serverError) : of(roles),
      ),
    } satisfies ApiStub<ProjectRolesService>;
    TestBed.configureTestingModule({
      providers: getDefaultProviders([
        { provide: ProjectRolesService, useValue: api },
      ]),
    });
    const service = TestBed.inject(ProjectRoleService);
    await firstValueFrom(service.loadRoles());
    fail = true;

    await expect(firstValueFrom(service.loadRoles())).rejects.toBe(serverError);

    expect(await firstValueFrom(service.projectRoles$)).toBe(roles);
  });
});
