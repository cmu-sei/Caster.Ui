// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  GroupMembership,
  GroupMembershipRole,
  GroupsService,
} from '../generated/caster-api';
import { ApiStub } from '../test-utils/api-stub';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { recordEmissions } from '../test-utils/record-emissions';
import { GroupMembershipService } from './group-membership.service';

function membership(overrides: Partial<GroupMembership> = {}): GroupMembership {
  return {
    id: 'gm1',
    groupId: 'g1',
    userId: 'u1',
    role: GroupMembershipRole.Member,
    ...overrides,
  };
}

/** The real BehaviorSubject-backed GroupMembershipService; GroupsService stubbed. */
function setup(api: ApiStub<GroupsService> = {}) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([{ provide: GroupsService, useValue: api }]),
  });
  return TestBed.inject(GroupMembershipService);
}

const ids = (list: GroupMembership[]) => list.map((m) => m.id);

describe('GroupMembershipService', () => {
  /**
   * Verifies: loadMemberships merges each group's memberships into one list,
   *   replacing known ids, and selectMemberships filters it by group.
   * Interacts with: GroupsService.getGroupMemberships (stub).
   * Data: g1 has gm1 and gm2; g2 has gm3; g1 is then reloaded with gm1 as
   *   a Manager.
   */
  it('merges loaded memberships and filters them by group', async () => {
    const byGroup: Record<string, GroupMembership[]> = {
      g1: [membership(), membership({ id: 'gm2', userId: 'u2' })],
      g2: [membership({ id: 'gm3', groupId: 'g2' })],
    };
    const api = {
      getGroupMemberships: vi.fn((groupId: string) => of(byGroup[groupId])),
    } satisfies ApiStub<GroupsService>;
    const service = setup(api);
    const g1 = recordEmissions(service.selectMemberships('g1'));

    await firstValueFrom(service.loadMemberships('g1'));
    await firstValueFrom(service.loadMemberships('g2'));
    byGroup.g1 = [membership({ role: GroupMembershipRole.Manager })];
    await firstValueFrom(service.loadMemberships('g1'));

    expect(ids(await firstValueFrom(service.groupMemberships$))).toEqual([
      'gm1',
      'gm2',
      'gm3',
    ]);
    expect(g1.map(ids)).toEqual([
      [],
      ['gm1', 'gm2'],
      ['gm1', 'gm2'],
      ['gm1', 'gm2'],
    ]);
    expect(g1.at(-1)?.[0].role).toBe(GroupMembershipRole.Manager);
  });

  /**
   * Verifies: create upserts the created membership, edit upserts the
   *   response by its id, and delete removes the membership.
   * Interacts with: GroupsService.createGroupMembership,
   *   editGroupMembership, deleteGroupMembership (stubs).
   * Data: create gm1 in g1; promote it to Manager; delete it.
   */
  it('create, edit and delete memberships', async () => {
    const api = {
      createGroupMembership: vi.fn(() => of(membership())),
      editGroupMembership: vi.fn(() =>
        of(membership({ role: GroupMembershipRole.Manager })),
      ),
      deleteGroupMembership: vi.fn(() => of(undefined)),
    } satisfies ApiStub<GroupsService>;
    const service = setup(api);

    await firstValueFrom(
      service.createMembership('g1', {
        userId: 'u1',
        role: GroupMembershipRole.Member,
      }),
    );
    await firstValueFrom(
      service.editMembership('gm1', { role: GroupMembershipRole.Manager }),
    );
    expect(await firstValueFrom(service.groupMemberships$)).toEqual([
      membership({ role: GroupMembershipRole.Manager }),
    ]);
    await firstValueFrom(service.deleteMembership('gm1'));

    expect(api.createGroupMembership).toHaveBeenCalledWith('g1', {
      userId: 'u1',
      role: GroupMembershipRole.Member,
    });
    expect(api.editGroupMembership).toHaveBeenCalledWith('gm1', {
      role: GroupMembershipRole.Manager,
    });
    expect(api.deleteGroupMembership).toHaveBeenCalledWith('gm1');
    expect(await firstValueFrom(service.groupMemberships$)).toEqual([]);
  });

  /**
   * Verifies: a failed deleteMembership passes the API error to the
   *   subscriber and keeps the membership in groupMemberships$.
   * Interacts with: GroupsService.getGroupMemberships (stub),
   *   deleteGroupMembership (stub, failing).
   * Data: g1 loaded with gm1; deleting gm1 fails with a 403.
   */
  it('keeps the membership when deleteMembership() fails', async () => {
    const forbidden = new Error('403 Forbidden');
    const api = {
      getGroupMemberships: vi.fn(() => of([membership()])),
      deleteGroupMembership: vi.fn(() => throwError(() => forbidden)),
    } satisfies ApiStub<GroupsService>;
    const service = setup(api);
    await firstValueFrom(service.loadMemberships('g1'));

    await expect(firstValueFrom(service.deleteMembership('gm1'))).rejects.toBe(
      forbidden,
    );

    expect(ids(await firstValueFrom(service.groupMemberships$))).toEqual([
      'gm1',
    ]);
  });
});
