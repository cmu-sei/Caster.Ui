// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetsService,
  ProjectEnvironmentSet,
} from '../generated/caster-api';
import { ApiStub } from '../test-utils/api-stub';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { EnvironmentSetService } from './environment-set.service';

const secrets: EnvironmentSecrets = {
  available: ['CASTER_SECRET_A'],
  missing: [],
  patterns: ['^CASTER_SECRET_'],
  runMode: 'Process',
  inheritAll: false,
};

function setup(api: ApiStub<EnvironmentSetsService>) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: EnvironmentSetsService, useValue: api },
    ]),
  });
  return TestBed.inject(EnvironmentSetService);
}

const names = (sets: EnvironmentSet[]) => sets.map((x) => x.name);

describe('EnvironmentSetService', () => {
  /**
   * Verifies: load() publishes the sets sorted by name, case-insensitively.
   * Interacts with: EnvironmentSetsService.getEnvironmentSets (stub).
   * Data: 'vsphere', 'AWS', 'proxmox'.
   */
  it('load() publishes the sets sorted by name', async () => {
    const service = setup({
      getEnvironmentSets: vi.fn(() =>
        of<EnvironmentSet[]>([
          { id: '1', name: 'vsphere' },
          { id: '2', name: 'AWS' },
          { id: '3', name: 'proxmox' },
        ]),
      ),
    });

    await firstValueFrom(service.load());

    expect(names(await firstValueFrom(service.sets$))).toEqual([
      'AWS',
      'proxmox',
      'vsphere',
    ]);
  });

  /**
   * Verifies: adding an entry replaces the set with the API's copy and re-reads the secrets once they were loaded, as a new source can be missing.
   * Interacts with: createEnvironmentSetEntry and getEnvironmentSecrets (stubs).
   * Data: set s1 with no entries; the API answers it with one.
   */
  it('createEntry() replaces the set and re-reads the secrets', async () => {
    const api = {
      getEnvironmentSecrets: vi.fn(() => of(secrets)),
      createEnvironmentSetEntry: vi.fn(() =>
        of<EnvironmentSet>({ id: 's1', name: 'A', entries: [{ id: 'e1' }] }),
      ),
    } satisfies ApiStub<EnvironmentSetsService>;
    const service = setup(api);
    service.upsert({ id: 's1', name: 'A', entries: [] });
    await firstValueFrom(service.loadSecrets());

    await firstValueFrom(
      service.createEntry('s1', {
        kind: 'EnvironmentVariable',
        targetName: 'TOKEN',
        valueSource: 'Secret',
        secretName: 'CASTER_SECRET_A',
      }),
    );

    expect((await firstValueFrom(service.sets$))[0].entries).toEqual([
      { id: 'e1' },
    ]);
    expect(api.getEnvironmentSecrets).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: assign() publishes the project's sets and re-reads the set, whose projects changed.
   * Interacts with: assignEnvironmentSet and getEnvironmentSet (stubs).
   * Data: set s1 assigned to project p1.
   */
  it('assign() updates the project sets and the set', async () => {
    const projectSet: ProjectEnvironmentSet = {
      environmentSetId: 's1',
      projectId: 'p1',
      name: 'A',
    };
    const api = {
      assignEnvironmentSet: vi.fn(() => of([projectSet])),
      getEnvironmentSet: vi.fn(() =>
        of<EnvironmentSet>({
          id: 's1',
          name: 'A',
          projects: [{ projectId: 'p1', name: 'Range' }],
        }),
      ),
    } satisfies ApiStub<EnvironmentSetsService>;
    const service = setup(api);

    await firstValueFrom(service.assign('p1', 's1'));

    expect(await firstValueFrom(service.projectSets$('p1'))).toEqual([
      projectSet,
    ]);
    expect((await firstValueFrom(service.sets$))[0].projects).toEqual([
      { projectId: 'p1', name: 'Range' },
    ]);
  });

  /**
   * Verifies: unassign() drops the set from that project's list and re-reads the set.
   * Interacts with: unassignEnvironmentSet and getEnvironmentSet (stubs).
   * Data: project p1 holds s1 and s2; s1 is removed.
   */
  it('unassign() drops the set from the project', async () => {
    const api = {
      unassignEnvironmentSet: vi.fn(() => of<unknown>(null)),
      getEnvironmentSet: vi.fn(() =>
        of<EnvironmentSet>({ id: 's1', name: 'A', projects: [] }),
      ),
    } satisfies ApiStub<EnvironmentSetsService>;
    const service = setup(api);
    service.projectSetsUpdated('p1', [
      { environmentSetId: 's1', projectId: 'p1', name: 'A' },
      { environmentSetId: 's2', projectId: 'p1', name: 'B' },
    ]);

    await firstValueFrom(service.unassign('p1', 's1'));

    expect(
      (await firstValueFrom(service.projectSets$('p1'))).map(
        (x) => x.environmentSetId,
      ),
    ).toEqual(['s2']);
  });

  /**
   * Verifies: delete() removes the set.
   * Interacts with: deleteEnvironmentSet (stub).
   * Data: sets s1 and s2; s1 deleted.
   */
  it('delete() removes the set', async () => {
    const service = setup({
      deleteEnvironmentSet: vi.fn(() => of<unknown>(null)),
    });
    service.upsert({ id: 's1', name: 'A' });
    service.upsert({ id: 's2', name: 'B' });

    await firstValueFrom(service.delete('s1'));

    expect(names(await firstValueFrom(service.sets$))).toEqual(['B']);
  });
});
