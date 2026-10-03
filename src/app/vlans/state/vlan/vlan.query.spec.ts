// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { Vlan } from '../../../generated/caster-api';
import { recordEmissions } from '../../../test-utils/record-emissions';
import { VlanQuery } from './vlan.query';
import { VlanStore } from './vlan.store';

const vlans: Vlan[] = [
  { id: 'v1', poolId: 'pl1', partitionId: 'pa1', vlanId: 101 },
  { id: 'v2', poolId: 'pl1', partitionId: null, vlanId: 102 },
  { id: 'v3', poolId: 'pl1', partitionId: 'pa2', vlanId: 103 },
  { id: 'v4', poolId: 'pl2', partitionId: null, vlanId: 201 },
];

function setup() {
  const store = new VlanStore();
  const query = new VlanQuery(store);
  store.add(vlans);
  return { store, query };
}

const ids = (list: Vlan[]) => list.map((v) => v.id);

describe('VlanQuery', () => {
  /**
   * Verifies: the store is named 'vlan', and the pool, unassigned and
   *   partition selectors filter on poolId / partitionId, keeping insertion
   *   order (no @QueryConfig sort).
   * Interacts with: selectAll({ filterBy }).
   * Data: v1 (pl1/pa1), v2 (pl1/none), v3 (pl1/pa2), v4 (pl2/none).
   */
  it('filters VLANs by pool, assignment and partition', async () => {
    const { store, query } = setup();

    expect(store.storeName).toBe('vlan');
    expect(ids(await firstValueFrom(query.selectByPoolId('pl1')))).toEqual([
      'v1',
      'v2',
      'v3',
    ]);
    expect(
      ids(await firstValueFrom(query.selectUnassignedByPoolId('pl1'))),
    ).toEqual(['v2']);
    expect(ids(await firstValueFrom(query.selectByPartitionId('pa2')))).toEqual(
      ['v3'],
    );
  });

  /**
   * Verifies: moving a VLAN into a partition moves it between the
   *   unassigned and partition selectors.
   * Interacts with: selectAll re-emission on store update.
   * Data: v2 assigned to pa1.
   */
  it('follows partition assignment changes', () => {
    const { store, query } = setup();
    const unassigned = recordEmissions(query.selectUnassignedByPoolId('pl1'));
    const inPa1 = recordEmissions(query.selectByPartitionId('pa1'));

    store.update('v2', { partitionId: 'pa1' });

    expect(unassigned.map(ids)).toEqual([['v2'], []]);
    expect(inPa1.map(ids)).toEqual([['v1'], ['v1', 'v2']]);
  });
});
