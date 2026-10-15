// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProjectMembership, ProjectsService } from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { recordEmissions } from '../../test-utils/record-emissions';
import { ProjectMembershipService } from './project-membership.service';

function membership(
  overrides: Partial<ProjectMembership> = {},
): ProjectMembership {
  return {
    id: 'pm1',
    projectId: 'p1',
    userId: 'u1',
    groupId: null,
    roleId: 'role-member',
    ...overrides,
  };
}

/** The real BehaviorSubject-backed ProjectMembershipService; ProjectsService stubbed. */
function setup(api: ApiStub<ProjectsService>) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: ProjectsService, useValue: api },
    ]),
  });
  return TestBed.inject(ProjectMembershipService);
}

const ids = (list: ProjectMembership[]) => list.map((m) => m.id);

describe('ProjectMembershipService', () => {
  /**
   * Verifies: loadMemberships replaces the published list with the project's
   *   memberships.
   * Interacts with: ProjectsService.getProjectMemberships (stub).
   * Data: p1 has pm1 and pm2; p2 has pm3.
   */
  it('loadMemberships() replaces the list with the project memberships', async () => {
    const byProject: Record<string, ProjectMembership[]> = {
      p1: [
        membership(),
        membership({ id: 'pm2', userId: null, groupId: 'g1' }),
      ],
      p2: [membership({ id: 'pm3', projectId: 'p2' })],
    };
    const api = {
      getProjectMemberships: vi.fn((projectId: string) =>
        of(byProject[projectId]),
      ),
    } satisfies ApiStub<ProjectsService>;
    const service = setup(api);
    const seen = recordEmissions(service.projectMemberships$);

    await firstValueFrom(service.loadMemberships('p1'));
    await firstValueFrom(service.loadMemberships('p2'));

    expect(seen.map(ids)).toEqual([[], ['pm1', 'pm2'], ['pm3']]);
  });

  /**
   * Verifies: createMembership appends the created membership, and
   *   editMembership merges the response into the membership named by the
   *   command id.
   * Interacts with: ProjectsService.createProjectMembership and
   *   editProjectMembership (stubs).
   * Data: loaded pm1; add group g1 (pm2); change pm1's role.
   */
  it('createMembership() and editMembership() upsert', async () => {
    const api = {
      getProjectMemberships: vi.fn(() => of([membership()])),
      createProjectMembership: vi.fn(() =>
        of(membership({ id: 'pm2', userId: null, groupId: 'g1' })),
      ),
      editProjectMembership: vi.fn(() =>
        of(membership({ roleId: 'role-manager' })),
      ),
    } satisfies ApiStub<ProjectsService>;
    const service = setup(api);
    await firstValueFrom(service.loadMemberships('p1'));

    await firstValueFrom(service.createMembership('p1', { groupId: 'g1' }));
    await firstValueFrom(
      service.editMembership({ id: 'pm1', roleId: 'role-manager' }),
    );

    expect(api.createProjectMembership).toHaveBeenCalledWith('p1', {
      groupId: 'g1',
    });
    expect(api.editProjectMembership).toHaveBeenCalledWith({
      id: 'pm1',
      roleId: 'role-manager',
    });
    expect(await firstValueFrom(service.projectMemberships$)).toEqual([
      membership({ roleId: 'role-manager' }),
      membership({ id: 'pm2', userId: null, groupId: 'g1' }),
    ]);
  });

  /**
   * Verifies: deleteMembership removes the membership after the API
   *   succeeds and keeps it when the API fails.
   * Interacts with: ProjectsService.deleteProjectMembership (stubs).
   * Data: loaded pm1 and pm2; delete pm1 (ok), then pm2 (error).
   */
  it('deleteMembership() removes the membership on success only', async () => {
    const api = {
      getProjectMemberships: vi.fn(() =>
        of([membership(), membership({ id: 'pm2' })]),
      ),
      deleteProjectMembership: vi.fn((id: string) =>
        id === 'pm1'
          ? of(undefined)
          : throwError(() => new Error('last manager')),
      ),
    } satisfies ApiStub<ProjectsService>;
    const service = setup(api);
    await firstValueFrom(service.loadMemberships('p1'));

    await firstValueFrom(service.deleteMembership('pm1'));
    const error = await firstValueFrom(service.deleteMembership('pm2')).catch(
      (e: unknown) => e,
    );

    expect(error).toEqual(new Error('last manager'));
    expect(ids(await firstValueFrom(service.projectMemberships$))).toEqual([
      'pm2',
    ]);
  });
});
