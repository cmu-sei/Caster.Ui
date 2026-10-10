// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { Partition, VlansService } from '../../../generated/caster-api';
import { ApiStub } from '../../../test-utils/api-stub';
import { getDefaultProviders } from '../../../test-utils/default-test-providers';
import { PartitionQuery } from './partition.query';
import { PartitionService } from './partition.service';
import { PartitionStore } from './partition.store';

function partition(overrides: Partial<Partition> = {}): Partition {
  return {
    id: 'pa1',
    poolId: 'pl1',
    name: 'red',
    isDefault: false,
    ...overrides,
  };
}

/** Real PartitionStore, PartitionQuery and PartitionService; VlansService stubbed. */
function setup(api: ApiStub<VlansService> = {}, partitions: Partition[] = []) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([{ provide: VlansService, useValue: api }]),
  });
  const store = TestBed.inject(PartitionStore);
  const query = TestBed.inject(PartitionQuery);
  const service = TestBed.inject(PartitionService);
  store.add(partitions);
  return { service, store, query };
}

const boom = () => throwError(() => new Error('boom'));

describe('PartitionService', () => {
  /**
   * Verifies: load and loadByPoolId replace the stored partitions with the
   *   API list and clear loading.
   * Interacts with: VlansService.getPartitions/getPartitionsByPool (stubs).
   * Data: stored pa9; load returns pa1; loadByPoolId('pl2') returns pa2.
   */
  it('load() and loadByPoolId() replace the partitions', async () => {
    const api = {
      getPartitions: vi.fn(() => of([partition()])),
      getPartitionsByPool: vi.fn(() =>
        of([partition({ id: 'pa2', poolId: 'pl2' })]),
      ),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api, [partition({ id: 'pa9' })]);

    await firstValueFrom(service.load());
    expect(query.getAll().map((p) => p.id)).toEqual(['pa1']);

    await firstValueFrom(service.loadByPoolId('pl2'));

    expect(api.getPartitionsByPool).toHaveBeenCalledWith('pl2');
    expect(query.getAll().map((p) => p.id)).toEqual(['pa2']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: both loads pass the error on and leave loading on when the API
   *   fails.
   * Interacts with: VlansService.getPartitions/getPartitionsByPool
   *   (throwError stubs).
   * Data: stored pa1 (loading false).
   */
  it.each([
    { method: 'load', call: (s: PartitionService) => s.load() },
    {
      method: 'loadByPoolId',
      call: (s: PartitionService) => s.loadByPoolId('pl1'),
    },
  ] satisfies {
    method: string;
    call: (s: PartitionService) => Observable<unknown>;
  }[])('$method leaves loading on when the API fails', async ({ call }) => {
    const { service, query } = setup(
      { getPartitions: vi.fn(boom), getPartitionsByPool: vi.fn(boom) },
      [partition()],
    );

    const error = await firstValueFrom(call(service)).catch((e: unknown) => e);

    expect(error).toEqual(new Error('boom'));
    expect(query.getValue().loading).toBe(true);
  });

  /**
   * Verifies: create posts 'New Partition' to the pool and upserts the
   *   response.
   * Interacts with: VlansService.createPartition (stub).
   * Data: pool pl1; the API returns pa3.
   */
  it('create() adds a "New Partition" to the pool', async () => {
    const api = {
      createPartition: vi.fn(() =>
        of(partition({ id: 'pa3', name: 'New Partition' })),
      ),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api);

    await firstValueFrom(service.create('pl1'));

    expect(api.createPartition).toHaveBeenCalledWith('pl1', {
      name: 'New Partition',
    });
    expect(query.getEntity('pa3').name).toBe('New Partition');
  });

  /**
   * Verifies: edit and partialEdit merge the response; delete removes the
   *   partition after the API succeeds.
   * Interacts with: VlansService.editPartition/partialEditPartition/
   *   deletePartition (stubs).
   * Data: stored pa1 and pa2.
   */
  it('edits and deletes partitions', async () => {
    const api = {
      editPartition: vi.fn(() => of(partition({ name: 'A' }))),
      partialEditPartition: vi.fn(() => of(partition({ name: 'B' }))),
      deletePartition: vi.fn(() => of(undefined)),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api, [
      partition(),
      partition({ id: 'pa2' }),
    ]);

    await firstValueFrom(service.edit('pa1', { name: 'A' }));
    await firstValueFrom(service.partialEdit('pa1', { name: 'B' }));
    await firstValueFrom(service.delete('pa2'));

    expect(api.editPartition).toHaveBeenCalledWith('pa1', { name: 'A' });
    expect(api.partialEditPartition).toHaveBeenCalledWith('pa1', { name: 'B' });
    expect(api.deletePartition).toHaveBeenCalledWith('pa2');
    expect(query.getAll()).toEqual([partition({ name: 'B' })]);
  });

  /**
   * Verifies: setDefault marks the partition default and unsetDefault clears
   *   it, each only after its API call succeeds; other partitions keep their
   *   flag locally.
   * Interacts with: VlansService.setDefaultPartition/unsetDefaultPartition
   *   (stubs).
   * Data: stored pa1 (default) and pa2.
   */
  it('setDefault() and unsetDefault() update the default flag', async () => {
    const api = {
      setDefaultPartition: vi.fn(() => of(undefined)),
      unsetDefaultPartition: vi.fn(() => of(undefined)),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api, [
      partition({ isDefault: true }),
      partition({ id: 'pa2', name: 'blue' }),
    ]);

    await firstValueFrom(service.setDefault('pa2'));

    expect(api.setDefaultPartition).toHaveBeenCalledWith('pa2');
    expect(query.getEntity('pa2').isDefault).toBe(true);
    // NOTE: the previous default is not cleared here; the server sends a
    // PartitionUpdated hub event for it.
    expect(query.getEntity('pa1').isDefault).toBe(true);

    await firstValueFrom(service.unsetDefault('pa2'));

    expect(api.unsetDefaultPartition).toHaveBeenCalledTimes(1);
    expect(query.getEntity('pa2').isDefault).toBe(false);
  });

  /**
   * Verifies: the hub handlers upsert (add() is an upsert here), merge-update
   *   and remove partitions.
   * Interacts with: PartitionStore.upsert/update/remove.
   * Data: stored pa1; add pa1 renamed and pa2; update pa2; remove pa1.
   */
  it('applies hub add (upsert), update and remove', () => {
    const { service, query } = setup({}, [partition()]);

    service.add(partition({ name: 'renamed' }));
    service.add(partition({ id: 'pa2', name: 'blue' }));
    expect(query.getEntity('pa1').name).toBe('renamed');

    service.update('pa2', { isDefault: true });
    service.remove('pa1');

    expect(query.getAll()).toEqual([
      partition({ id: 'pa2', name: 'blue', isDefault: true }),
    ]);
  });
});
