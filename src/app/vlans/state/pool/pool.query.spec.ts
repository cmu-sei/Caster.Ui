// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { PoolQuery } from './pool.query';
import { PoolStore } from './pool.store';

describe('PoolQuery', () => {
  /**
   * Verifies: the store is named 'pool' and pools come out in
   *   case-insensitive name order, although @Injectable is declared above
   *   @QueryConfig here.
   * Interacts with: selectAll + @QueryConfig sortBy 'name'.
   * Data: pools 'lab', 'Default', 'event' added in that order.
   */
  it('sorts pools by name', async () => {
    const store = new PoolStore();
    const query = new PoolQuery(store);
    store.add([
      { id: 'l', name: 'lab' },
      { id: 'd', name: 'Default', isDefault: true },
      { id: 'e', name: 'event' },
    ]);

    const all = await firstValueFrom(query.selectAll());

    expect(store.storeName).toBe('pool');
    expect(all.map((p) => p.id)).toEqual(['d', 'e', 'l']);
  });
});
