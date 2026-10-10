// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Theme } from '@cmusei/crucible-common';
import {
  createInitialCurrentUserState,
  CurrentUserStore,
  initialUserUiState,
  UserStore,
} from './user.store';

describe('UserStore', () => {
  /**
   * Verifies: the store registers as 'users' with a 'UI/users' UI store, and
   *   a new user gets unselected, not-editing, unsaved UI state.
   * Interacts with: @StoreConfig, EntityStore.add -> setInitialEntityState.
   * Data: user u1.
   */
  it('is named users and creates default UI state', () => {
    const store = new UserStore();

    store.add({ id: 'u1', name: 'Ada' });

    expect(store.storeName).toBe('users');
    expect(store.ui.storeName).toBe('UI/users');
    expect(initialUserUiState).toEqual({
      isSelected: false,
      isEditing: false,
      isSaved: false,
    });
    expect(store.ui.getValue().entities['u1']).toEqual({
      id: 'u1',
      ...initialUserUiState,
    });
  });
});

describe('CurrentUserStore', () => {
  /**
   * Verifies: the store registers as 'currentUser' and starts with no user,
   *   the light theme and no last route; the factory returns a fresh object.
   * Interacts with: @StoreConfig, createInitialCurrentUserState.
   * Data: a fresh store.
   */
  it('starts anonymous on the light theme', () => {
    const store = new CurrentUserStore();

    expect(store.storeName).toBe('currentUser');
    expect(store.getValue()).toEqual({
      name: '',
      id: '',
      theme: Theme.LIGHT,
      lastRoute: '',
    });
    expect(createInitialCurrentUserState()).not.toBe(
      createInitialCurrentUserState(),
    );
  });
});
