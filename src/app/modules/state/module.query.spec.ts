// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { recordEmissions } from '../../test-utils/record-emissions';
import { ModuleQuery } from './module.query';
import { ModuleStore } from './module.store';

function setup() {
  const store = new ModuleStore();
  return { store, query: new ModuleQuery(store) };
}

describe('ModuleQuery', () => {
  /**
   * Verifies: modules come out in case-insensitive name order.
   * Interacts with: selectAll + @QueryConfig sortBy 'name'.
   * Data: 'vm', 'Network', 'dns' added in that order.
   */
  it('sorts modules by name, ignoring case', async () => {
    const { store, query } = setup();
    store.add([
      { id: 'v', name: 'vm' },
      { id: 'n', name: 'Network' },
      { id: 'd', name: 'dns' },
    ]);

    const all = await firstValueFrom(query.selectAll());

    expect(all.map((m) => m.id)).toEqual(['d', 'n', 'v']);
  });

  /**
   * Verifies: isLoading$ follows the store's loading flag.
   * Interacts with: select(state.loading).
   * Data: fresh store (loading), then setLoading(false) and (true).
   */
  it('tracks the loading flag', () => {
    const { store, query } = setup();
    const seen = recordEmissions(query.isLoading$);

    store.setLoading(false);
    store.setLoading(true);

    expect(seen).toEqual([true, false, true]);
  });

  /**
   * Verifies: selectByModuleId follows one module and emits undefined until
   *   it is loaded.
   * Interacts with: selectEntity.
   * Data: empty store; m1 added, then renamed.
   */
  it('selects a module by id', () => {
    const { store, query } = setup();
    const seen = recordEmissions(query.selectByModuleId('m1'));

    store.add({ id: 'm1', name: 'vm' });
    store.update('m1', { name: 'vm2' });

    expect(seen.map((m) => m?.name)).toEqual([undefined, 'vm', 'vm2']);
  });
});
