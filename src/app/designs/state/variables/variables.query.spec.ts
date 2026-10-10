// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { Variable, VariableType } from '../../../generated/caster-api';
import { recordEmissions } from '../../../test-utils/record-emissions';
import { VariablesQuery } from './variables.query';
import { VariablesStore } from './variables.store';

function variable(overrides: Partial<Variable> = {}): Variable {
  return {
    id: 'v1',
    designId: 'g1',
    name: 'region',
    type: VariableType.String,
    ...overrides,
  };
}

describe('VariablesQuery', () => {
  /**
   * Verifies: the store is named 'variables', and selectByDesignId returns
   *   only that design's variables, sorted by name.
   * Interacts with: selectAll({ filterBy }) + @QueryConfig sortBy 'name'.
   * Data: 'region' and 'count' in g1; 'zone' in g2.
   */
  it('selects a design variables by name', async () => {
    const store = new VariablesStore();
    const query = new VariablesQuery(store);
    store.add([
      variable(),
      variable({ id: 'v2', name: 'count', type: VariableType.Number }),
      variable({ id: 'v3', name: 'zone', designId: 'g2' }),
    ]);

    const variables = await firstValueFrom(query.selectByDesignId('g1'));

    expect(store.storeName).toBe('variables');
    expect(variables.map((v) => v.name)).toEqual(['count', 'region']);
  });

  /**
   * Verifies: selectByDesignId re-emits when a variable joins the design.
   * Interacts with: selectAll re-emission on store add.
   * Data: g1 with 'region'; then 'count' is added.
   */
  it('follows variables added to the design', () => {
    const store = new VariablesStore();
    const query = new VariablesQuery(store);
    store.add(variable());
    const seen = recordEmissions(query.selectByDesignId('g1'));

    store.add(variable({ id: 'v2', name: 'count' }));

    expect(seen.map((vs) => vs.map((v) => v.name))).toEqual([
      ['region'],
      ['count', 'region'],
    ]);
  });
});
