// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { Pool, VlansService } from '../../../generated/caster-api';
import { ApiStub } from '../../../test-utils/api-stub';
import { getDefaultProviders } from '../../../test-utils/default-test-providers';
import { recordEmissions } from '../../../test-utils/record-emissions';
import { PoolQuery } from './pool.query';
import { PoolService } from './pool.service';
import { PoolStore } from './pool.store';

function pool(overrides: Partial<Pool> = {}): Pool {
  return { id: 'pl1', name: 'Default', isDefault: true, ...overrides };
}

/** Real PoolStore, PoolQuery and PoolService; VlansService stubbed. */
function setup(api: ApiStub<VlansService> = {}, pools: Pool[] = []) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([{ provide: VlansService, useValue: api }]),
  });
  const store = TestBed.inject(PoolStore);
  const query = TestBed.inject(PoolQuery);
  const service = TestBed.inject(PoolService);
  store.add(pools);
  return { service, store, query };
}

describe('PoolService', () => {
  /**
   * Verifies: load turns loading on immediately, replaces the pools with the
   *   API list and clears loading.
   * Interacts with: VlansService.getPools (Subject stub).
   * Data: stored pl9; the API returns pl1 and pl2.
   */
  it('load() replaces the pools and toggles loading', () => {
    const response$ = new Subject<Pool[]>();
    const api = {
      getPools: vi.fn(() => response$),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api, [pool({ id: 'pl9', name: 'Old' })]);

    const load$ = service.load();
    expect(query.getValue().loading).toBe(true);
    recordEmissions(load$);
    response$.next([
      pool(),
      pool({ id: 'pl2', name: 'Lab', isDefault: false }),
    ]);

    expect(query.getAll().map((p) => p.id)).toEqual(['pl1', 'pl2']);
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: a failed load passes the error on and leaves loading on.
   * Interacts with: VlansService.getPools (throwError stub).
   * Data: stored pl1 (loading false); the API errors with 'boom'.
   */
  it('load() leaves loading on when the API fails', async () => {
    const { service, query } = setup(
      { getPools: vi.fn(() => throwError(() => new Error('boom'))) },
      [pool()],
    );

    const error = await firstValueFrom(service.load()).catch((e: unknown) => e);

    expect(error).toEqual(new Error('boom'));
    expect(query.getValue().loading).toBe(true);
    expect(query.getAll()).toEqual([pool()]);
  });

  /**
   * Verifies: create posts a pool named 'New Pool' and adds the response.
   * Interacts with: VlansService.createPool (stub).
   * Data: empty store; the API returns pl3.
   */
  it('create() adds a "New Pool"', async () => {
    const api = {
      createPool: vi.fn(() =>
        of(pool({ id: 'pl3', name: 'New Pool', isDefault: false })),
      ),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api);

    await firstValueFrom(service.create());

    expect(api.createPool).toHaveBeenCalledWith({ name: 'New Pool' });
    expect(query.getEntity('pl3').name).toBe('New Pool');
  });

  /**
   * Verifies: edit and partialEdit send their command for the id and merge
   *   the response into the stored pool.
   * Interacts with: VlansService.editPool/partialEditPool (stubs).
   * Data: stored pl1; edit renames to 'A', partialEdit to 'B'.
   */
  it('edit() and partialEdit() merge the response', async () => {
    const api = {
      editPool: vi.fn(() => of(pool({ name: 'A' }))),
      partialEditPool: vi.fn(() => of(pool({ name: 'B' }))),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api, [pool()]);

    await firstValueFrom(service.edit('pl1', { name: 'A' }));
    expect(query.getEntity('pl1').name).toBe('A');
    await firstValueFrom(service.partialEdit('pl1', { name: 'B' }));

    expect(api.editPool).toHaveBeenCalledWith('pl1', { name: 'A' });
    expect(api.partialEditPool).toHaveBeenCalledWith('pl1', { name: 'B' });
    expect(query.getEntity('pl1').name).toBe('B');
  });

  /**
   * Verifies: delete sends the force flag and removes the pool on success
   *   only.
   * Interacts with: VlansService.deletePool (stubs).
   * Data: stored pl1 and pl2; force-delete pl1 (ok); delete pl2 (error).
   */
  it('delete() sends the force flag and removes the pool on success', async () => {
    const api = {
      deletePool: vi.fn((id: string) =>
        id === 'pl1' ? of(undefined) : throwError(() => new Error('in use')),
      ),
    } satisfies ApiStub<VlansService>;
    const { service, query } = setup(api, [
      pool(),
      pool({ id: 'pl2', name: 'Lab' }),
    ]);

    await firstValueFrom(service.delete('pl1', true));
    const error = await firstValueFrom(service.delete('pl2', false)).catch(
      (e: unknown) => e,
    );

    expect(api.deletePool.mock.calls).toEqual([
      ['pl1', { force: true }],
      ['pl2', { force: false }],
    ]);
    expect(query.getAll().map((p) => p.id)).toEqual(['pl2']);
    expect(error).toEqual(new Error('in use'));
  });

  /**
   * Verifies: the hub handlers add, merge-update and remove pools.
   * Interacts with: PoolStore.add/update/remove.
   * Data: stored pl1; add pl2; update pl1; remove pl2.
   */
  it('applies hub add, update and remove', () => {
    const { service, query } = setup({}, [pool()]);

    service.add(pool({ id: 'pl2', name: 'Lab' }));
    service.update('pl1', { isDefault: false });
    service.remove('pl2');

    expect(query.getAll()).toEqual([pool({ isDefault: false })]);
  });
});
