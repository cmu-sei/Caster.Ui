// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Group, GroupsService } from '../generated/caster-api';
import { ApiStub } from '../test-utils/api-stub';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { recordEmissions } from '../test-utils/record-emissions';
import { GroupService } from './group.service';

/** The real BehaviorSubject-backed GroupService; GroupsService stubbed. */
async function setup(api: ApiStub<GroupsService>, initial: Group[] = []) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      {
        provide: GroupsService,
        useValue: {
          getAllGroups: vi.fn(() => of(initial)),
          ...api,
        } satisfies ApiStub<GroupsService>,
      },
    ]),
  });
  const service = TestBed.inject(GroupService);
  await firstValueFrom(service.load());
  return service;
}

const ids = (groups: Group[]) => groups.map((g) => g.id);

describe('GroupService', () => {
  /**
   * Verifies: groups$ starts empty and load() publishes the API's groups.
   * Interacts with: GroupsService.getAllGroups (stub).
   * Data: the API returns g1 and g2.
   */
  it('load() publishes the groups', async () => {
    const api = {
      getAllGroups: vi.fn(() =>
        of<Group[]>([
          { id: 'g1', name: 'Red' },
          { id: 'g2', name: 'Blue' },
        ]),
      ),
    } satisfies ApiStub<GroupsService>;
    TestBed.configureTestingModule({
      providers: getDefaultProviders([
        { provide: GroupsService, useValue: api },
      ]),
    });
    const service = TestBed.inject(GroupService);
    const seen = recordEmissions(service.groups$);

    await firstValueFrom(service.load());

    expect(seen.map(ids)).toEqual([[], ['g1', 'g2']]);
  });

  /**
   * Verifies: create appends the created group, edit replaces the group with
   *   the same id, and delete removes it.
   * Interacts with: GroupsService.createGroup/editGroup/deleteGroup (stubs).
   * Data: loaded g1; create g2; rename g1; delete g2.
   */
  it('create(), edit() and delete() update groups$', async () => {
    const api = {
      createGroup: vi.fn(() => of<Group>({ id: 'g2', name: 'Blue' })),
      editGroup: vi.fn(() => of<Group>({ id: 'g1', name: 'Crimson' })),
      deleteGroup: vi.fn(() => of(undefined)),
    } satisfies ApiStub<GroupsService>;
    const service = await setup(api, [{ id: 'g1', name: 'Red' }]);

    await firstValueFrom(service.create({ name: 'Blue' }));
    await firstValueFrom(service.edit({ id: 'g1', name: 'Crimson' }));
    expect(await firstValueFrom(service.groups$)).toEqual([
      { id: 'g1', name: 'Crimson' },
      { id: 'g2', name: 'Blue' },
    ]);
    await firstValueFrom(service.delete('g2'));

    expect(api.createGroup).toHaveBeenCalledWith({ name: 'Blue' });
    expect(api.editGroup).toHaveBeenCalledWith({ id: 'g1', name: 'Crimson' });
    expect(api.deleteGroup).toHaveBeenCalledWith('g2');
    expect(ids(await firstValueFrom(service.groups$))).toEqual(['g1']);
  });

  /**
   * Verifies: create and edit change the published array in place and
   *   re-emit the same reference; an edit for an unknown id emits nothing.
   * Interacts with: BehaviorSubject.getValue/next.
   * Data: loaded g1; create g2; edit unknown g9.
   */
  it('mutates the published array in place', async () => {
    const api = {
      createGroup: vi.fn(() => of<Group>({ id: 'g2', name: 'Blue' })),
      editGroup: vi.fn(() => of<Group>({ id: 'g9', name: 'Ghost' })),
    } satisfies ApiStub<GroupsService>;
    const service = await setup(api, [{ id: 'g1', name: 'Red' }]);
    const before = await firstValueFrom(service.groups$);
    const emitted: Group[][] = [];
    const sub = service.groups$.subscribe((g) => emitted.push(g));

    await firstValueFrom(service.create({ name: 'Blue' }));
    await firstValueFrom(service.edit({ id: 'g9', name: 'Ghost' }));
    sub.unsubscribe();

    // A consumer that compared references (distinctUntilChanged, an OnPush
    // child @Input) would see no change, because the array is the same
    // object. Today's consumers re-derive on every emission
    // (AdminGroupsComponent re-assigns its MatTableDataSource.data;
    // ProjectMembershipsComponent maps through combineLatest).
    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toBe(before);
    expect(ids(before)).toEqual(['g1', 'g2']);
  });

  /**
   * Verifies: a failed create passes the error on and leaves groups$ as it
   *   was.
   * Interacts with: GroupsService.createGroup (throwError stub).
   * Data: loaded g1; the API errors with 'boom'.
   */
  it('keeps the groups when create fails', async () => {
    const service = await setup(
      { createGroup: vi.fn(() => throwError(() => new Error('boom'))) },
      [{ id: 'g1', name: 'Red' }],
    );

    const error = await firstValueFrom(service.create({ name: 'x' })).catch(
      (e: unknown) => e,
    );

    expect(error).toEqual(new Error('boom'));
    expect(ids(await firstValueFrom(service.groups$))).toEqual(['g1']);
  });
});
