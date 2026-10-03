// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { Theme } from '@cmusei/crucible-common';
import { recordEmissions } from '../../test-utils/record-emissions';
import { CurrentUserQuery, UserQuery } from './user.query';
import { CurrentUserStore, UserStore } from './user.store';

describe('UserQuery', () => {
  /**
   * Verifies: users come out in case-insensitive name order, isLoading$
   *   follows the loading flag, and selectByUserId follows one user.
   * Interacts with: selectAll + @QueryConfig; select(loading); selectEntity.
   * Data: users 'bob', 'Ada', 'carol' added to a fresh (loading) store.
   */
  it('sorts users, tracks loading and selects by id', async () => {
    const store = new UserStore();
    const query = new UserQuery(store);
    const loading = recordEmissions(query.isLoading$);
    const ada = recordEmissions(query.selectByUserId('a'));

    store.add([
      { id: 'b', name: 'bob' },
      { id: 'a', name: 'Ada' },
      { id: 'c', name: 'carol' },
    ]);

    expect((await firstValueFrom(query.selectAll())).map((u) => u.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(loading).toEqual([true, false]);
    expect(ada).toEqual([undefined, { id: 'a', name: 'Ada' }]);
  });
});

describe('CurrentUserQuery', () => {
  /**
   * Verifies: userTheme$ follows the stored theme.
   * Interacts with: select(state.theme).
   * Data: fresh store (light), then dark.
   */
  it('selects the user theme', () => {
    const store = new CurrentUserStore();
    const query = new CurrentUserQuery(store);
    const seen = recordEmissions(query.userTheme$);

    store.update({ theme: Theme.DARK });

    expect(seen).toEqual([Theme.LIGHT, Theme.DARK]);
  });

  /**
   * Verifies: getLastRoute falls back to '/' until a route is recorded.
   * Interacts with: store.getValue().lastRoute.
   * Data: fresh store; then lastRoute '/projects/p1'.
   */
  it('returns the last route, or / when none is recorded', () => {
    const store = new CurrentUserStore();
    const query = new CurrentUserQuery(store);

    expect(query.getLastRoute()).toBe('/');

    store.update({ lastRoute: '/projects/p1' });

    expect(query.getLastRoute()).toBe('/projects/p1');
  });
});
