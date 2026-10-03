// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { Partition } from '../../../generated/caster-api';
import { PartitionQuery } from './partition.query';
import { PartitionStore } from './partition.store';

function setup(partitions: Partition[]) {
  const store = new PartitionStore();
  const query = new PartitionQuery(store);
  store.add(partitions);
  return { store, query };
}

const partitions: Partition[] = [
  { id: 'pa1', poolId: 'pl1', name: 'red' },
  { id: 'pa2', poolId: 'pl1', name: 'Blue' },
  { id: 'pa3', poolId: 'pl2', name: 'green' },
];

describe('PartitionQuery', () => {
  /**
   * Verifies: the store is named 'partition', and selectByPoolId returns the
   *   pool's partitions sorted by name.
   * Interacts with: selectAll({ filterBy }) + @QueryConfig sortBy 'name'.
   * Data: red and Blue in pl1; green in pl2.
   */
  it('selects the partitions of a pool by name', async () => {
    const { store, query } = setup(partitions);

    const inPool = await firstValueFrom(query.selectByPoolId('pl1'));

    expect(store.storeName).toBe('partition');
    expect(inPool.map((p) => p.id)).toEqual(['pa2', 'pa1']);
  });

  /**
   * Verifies: selectByPoolId leaves out the excluded partition id.
   * Interacts with: selectByPoolId filterBy (x.id != excludePartitionId).
   * Data: pool pl1, excluding pa2.
   */
  it('excludes the given partition', async () => {
    const { query } = setup(partitions);

    const others = await firstValueFrom(query.selectByPoolId('pl1', 'pa2'));

    expect(others.map((p) => p.id)).toEqual(['pa1']);
  });
});
