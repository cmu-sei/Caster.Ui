// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { recordEmissions } from '../../test-utils/record-emissions';
import { FileVersionQuery } from './fileVersion.query';
import { FileVersionStore } from './fileVersion.store';

describe('FileVersionQuery', () => {
  /**
   * Verifies: selectByFileVersionId follows one version, and isLoading$
   *   follows the loading flag.
   * Interacts with: selectEntity; select(state.loading).
   * Data: empty store; fv1 added (which also clears loading).
   */
  it('selects a version by id and tracks loading', () => {
    const store = new FileVersionStore();
    const query = new FileVersionQuery(store);
    const version = recordEmissions(query.selectByFileVersionId('fv1'));
    const loading = recordEmissions(query.isLoading$);

    store.add({ id: 'fv1', fileId: 'f1', name: 'main.tf', tag: 'v1' });

    expect(version.map((v) => v?.tag)).toEqual([undefined, 'v1']);
    expect(loading).toEqual([true, false]);
  });
});
