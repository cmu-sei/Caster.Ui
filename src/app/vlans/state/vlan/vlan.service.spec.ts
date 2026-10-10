// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import {
  PartialEditVlanCommand,
  ReserveVlansResult,
  Vlan,
  VlansService,
} from '../../../generated/caster-api';
import { ApiStub, endpointStub } from '../../../test-utils/api-stub';
import { getDefaultProviders } from '../../../test-utils/default-test-providers';
import { recordEmissions } from '../../../test-utils/record-emissions';
import { VlanQuery } from './vlan.query';
import { VlanService } from './vlan.service';
import { VlanStore } from './vlan.store';

function vlan(overrides: Partial<Vlan> = {}): Vlan {
  return {
    id: 'v1',
    poolId: 'pl1',
    partitionId: null,
    vlanId: 101,
    inUse: false,
    reserved: false,
    tag: null,
    ...overrides,
  };
}

/** Real VlanStore, VlanQuery and VlanService; VlansService stubbed. */
function setup(api: ApiStub<VlansService> = {}, vlans: Vlan[] = []) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([{ provide: VlansService, useValue: api }]),
  });
  const store = TestBed.inject(VlanStore);
  const query = TestBed.inject(VlanQuery);
  const service = TestBed.inject(VlanService);
  store.add(vlans);
  return { service, store, query };
}

describe('VlanService', () => {
  describe('loadByPoolId', () => {
    /**
     * Verifies: turns loading on immediately, replaces the stored VLANs with
     *   the pool's list and clears loading.
     * Interacts with: VlansService.getVlansByPool (Subject stub).
     * Data: stored v9 of another pool; the API returns v1 and v2.
     */
    it('replaces the VLANs and toggles loading', () => {
      const response$ = new Subject<Vlan[]>();
      const api = {
        getVlansByPool: vi.fn(() => response$),
      } satisfies ApiStub<VlansService>;
      const { service, query } = setup(api, [
        vlan({ id: 'v9', poolId: 'pl9' }),
      ]);

      const load$ = service.loadByPoolId('pl1');
      expect(query.getValue().loading).toBe(true);
      recordEmissions(load$);
      response$.next([vlan(), vlan({ id: 'v2', vlanId: 102 })]);

      expect(api.getVlansByPool).toHaveBeenCalledWith('pl1');
      expect(query.getAll().map((v) => v.id)).toEqual(['v1', 'v2']);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: a failed load passes the error on and leaves loading on.
     * Interacts with: VlansService.getVlansByPool (throwError stub).
     * Data: stored v1 (loading false); the API errors with 'boom'.
     */
    it('leaves loading on when the API fails', async () => {
      const { service, query } = setup(
        { getVlansByPool: vi.fn(() => throwError(() => new Error('boom'))) },
        [vlan()],
      );

      const error = await firstValueFrom(service.loadByPoolId('pl1')).catch(
        (e: unknown) => e,
      );

      expect(error).toEqual(new Error('boom'));
      expect(query.getValue().loading).toBe(true);
    });
  });

  describe('partition membership', () => {
    /**
     * Verifies: addToPartition and removeFromPartition send a VLAN count and
     *   upsert the VLANs the API moved.
     * Interacts with: VlansService.addVlansToPartition/removeVlansFromPartition
     *   (stubs); VlanStore.upsertMany.
     * Data: stored v1 and v2 unassigned; add 2 to pa1; remove 1 from pa1.
     */
    it('adds and removes a number of VLANs', async () => {
      const api = {
        addVlansToPartition: vi.fn(() =>
          of([
            vlan({ partitionId: 'pa1' }),
            vlan({ id: 'v2', vlanId: 102, partitionId: 'pa1' }),
          ]),
        ),
        removeVlansFromPartition: vi.fn(() =>
          of([vlan({ id: 'v2', vlanId: 102 })]),
        ),
      } satisfies ApiStub<VlansService>;
      const { service, query } = setup(api, [
        vlan(),
        vlan({ id: 'v2', vlanId: 102 }),
      ]);

      await firstValueFrom(service.addToPartition('pa1', 2));
      expect(api.addVlansToPartition).toHaveBeenCalledWith('pa1', { vlans: 2 });
      expect(query.getAll().map((v) => v.partitionId)).toEqual(['pa1', 'pa1']);

      await firstValueFrom(service.removeFromPartition('pa1', 1));

      expect(api.removeVlansFromPartition).toHaveBeenCalledWith('pa1', {
        vlans: 1,
      });
      expect(query.getEntity('v2').partitionId).toBeNull();
      expect(query.getEntity('v1').partitionId).toBe('pa1');
    });

    const reassignRows: {
      case: string;
      from: string | null;
      to: string | null;
      endpoint:
        'addVlansToPartition' | 'removeVlansFromPartition' | 'reassignVlans';
      args: unknown[];
    }[] = [
      {
        case: 'from no partition',
        from: null,
        to: 'pa2',
        endpoint: 'addVlansToPartition',
        args: ['pa2', { vlanIds: ['v1'] }],
      },
      {
        case: 'to no partition',
        from: 'pa1',
        to: null,
        endpoint: 'removeVlansFromPartition',
        args: ['pa1', { vlanIds: ['v1'] }],
      },
      {
        case: 'between partitions',
        from: 'pa1',
        to: 'pa2',
        endpoint: 'reassignVlans',
        args: [
          { fromPartitionId: 'pa1', toPartitionId: 'pa2', vlanIds: ['v1'] },
        ],
      },
    ];

    /**
     * Verifies: reassign picks the add, remove or reassign endpoint from
     *   which side is null, and upserts the returned VLANs.
     * Interacts with: the chosen VlansService endpoint (stub).
     * Data: v1 in the row's source partition; the API returns v1 in the
     *   target partition.
     */
    it.each(reassignRows)(
      'reassign() $case calls $endpoint',
      async ({ from, to, endpoint, args }) => {
        const endpointFn = vi.fn(() => of([vlan({ partitionId: to })]));
        const { service, query } = setup(
          endpointStub(VlansService, endpoint, endpointFn),
          [vlan({ partitionId: from })],
        );

        await firstValueFrom(service.reassign(['v1'], from, to));

        expect(endpointFn).toHaveBeenCalledWith(...args);
        expect(query.getEntity('v1').partitionId).toBe(to);
      },
    );
  });

  describe('single VLAN actions', () => {
    /**
     * Verifies: acquire sends the VLAN's partition and number, and release
     *   sends its id; each merges the returned VLAN.
     * Interacts with: VlansService.acquireVlan/releaseVlan (stubs).
     * Data: stored v1 in pa1.
     */
    it('acquire() and release() update the VLAN', async () => {
      const api = {
        acquireVlan: vi.fn(() =>
          of(vlan({ partitionId: 'pa1', inUse: true, tag: 'event-1' })),
        ),
        releaseVlan: vi.fn(() =>
          of(vlan({ partitionId: 'pa1', inUse: false })),
        ),
      } satisfies ApiStub<VlansService>;
      const { service, query } = setup(api, [vlan({ partitionId: 'pa1' })]);

      await firstValueFrom(service.acquire(vlan({ partitionId: 'pa1' })));
      expect(api.acquireVlan).toHaveBeenCalledWith({
        partitionId: 'pa1',
        vlanId: 101,
      });
      expect(query.getEntity('v1')).toMatchObject({
        inUse: true,
        tag: 'event-1',
      });

      await firstValueFrom(service.release(vlan({ partitionId: 'pa1' })));

      expect(api.releaseVlan).toHaveBeenCalledWith('v1');
      expect(query.getEntity('v1').inUse).toBe(false);
    });

    /**
     * Verifies: reserve and unreserve send partialEditVlan with the reserved
     *   flag; partialEdit sends the given command; each merges the response.
     * Interacts with: VlansService.partialEditVlan (stub echoing the command).
     * Data: stored v1.
     */
    it('reserve(), unreserve() and partialEdit() patch the VLAN', async () => {
      const api = {
        partialEditVlan: vi.fn(
          (_id: string, command?: PartialEditVlanCommand) =>
            of(vlan({ ...command })),
        ),
      } satisfies ApiStub<VlansService>;
      const { service, query } = setup(api, [vlan()]);

      await firstValueFrom(service.reserve(vlan()));
      expect(query.getEntity('v1').reserved).toBe(true);
      await firstValueFrom(service.unreserve(vlan()));
      expect(query.getEntity('v1').reserved).toBe(false);
      await firstValueFrom(service.partialEdit('v1', { tag: 'lab' }));

      expect(api.partialEditVlan.mock.calls).toEqual([
        ['v1', { reserved: true }],
        ['v1', { reserved: false }],
        ['v1', { tag: 'lab' }],
      ]);
      expect(query.getEntity('v1').tag).toBe('lab');
    });

    /**
     * Verifies: bulkReserve forwards the ids and flag and returns the result
     *   without touching the store (hub events update it).
     * Interacts with: VlansService.reserveVlans (stub).
     * Data: stored v1 and v2; reserve both.
     */
    it('bulkReserve() forwards to the API', async () => {
      const result: ReserveVlansResult = {
        updated: ['v1'],
        notUpdated: ['v2'],
      };
      const api = {
        reserveVlans: vi.fn(() => of(result)),
      } satisfies ApiStub<VlansService>;
      const stored = [vlan(), vlan({ id: 'v2', vlanId: 102 })];
      const { service, query } = setup(api, stored);

      expect(
        await firstValueFrom(service.bulkReserve(true, ['v1', 'v2'])),
      ).toBe(result);
      expect(api.reserveVlans).toHaveBeenCalledWith({
        reserved: true,
        vlanIds: ['v1', 'v2'],
      });
      expect(query.getAll()).toEqual(stored);
    });
  });

  /**
   * Verifies: the hub handlers add, merge-update and remove VLANs.
   * Interacts with: VlanStore.add/update/remove.
   * Data: stored v1; add v2; update v1; remove v2.
   */
  it('applies hub add, update and remove', () => {
    const { service, query } = setup({}, [vlan()]);

    service.add(vlan({ id: 'v2', vlanId: 102 }));
    service.update('v1', { reserved: true });
    service.remove('v2');

    expect(query.getAll()).toEqual([vlan({ reserved: true })]);
  });
});
