// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { recordEmissions } from '../../test-utils/record-emissions';
import { DirectoryQuery } from './directory.query';
import { DirectoryStore } from './directory.store';

describe('DirectoryQuery', () => {
  /**
   * Verifies: directories come out in case-insensitive name order.
   * Interacts with: QueryEntity.selectAll + @QueryConfig sortBy 'name'.
   * Data: directories 'modules', 'Base', 'envs' added in that order.
   */
  it('sorts directories by name, ignoring case', async () => {
    const store = new DirectoryStore();
    const query = new DirectoryQuery(store);
    store.add([
      { id: 'm', name: 'modules' },
      { id: 'b', name: 'Base' },
      { id: 'e', name: 'envs' },
    ]);

    const all = await firstValueFrom(query.selectAll());

    expect(all.map((d) => d.id)).toEqual(['b', 'e', 'm']);
  });

  /**
   * Verifies: the UI query follows a directory's expansion flags.
   * Interacts with: ui.selectEntity.
   * Data: d1, then expanded.
   */
  it('exposes per-directory UI state', () => {
    const store = new DirectoryStore();
    const query = new DirectoryQuery(store);
    store.add({ id: 'd1', name: 'root' });
    const seen = recordEmissions(
      query.ui.selectEntity('d1', (ui) => ui.isExpanded),
    );

    store.ui.update('d1', { isExpanded: true });

    expect(seen).toEqual([false, true]);
  });
});
