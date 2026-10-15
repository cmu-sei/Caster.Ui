// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { initialModuleUiState, ModuleStore } from './module.store';

describe('ModuleStore', () => {
  /**
   * Verifies: the store registers as 'modules' with a 'UI/modules' UI store,
   *   and starts empty and loading.
   * Interacts with: @StoreConfig, EntityStore.createUIStore.
   * Data: a fresh store.
   */
  it('is named modules and starts empty and loading', () => {
    const store = new ModuleStore();

    expect(store.storeName).toBe('modules');
    expect(store.ui.storeName).toBe('UI/modules');
    expect(store.getValue()).toEqual({
      entities: {},
      ids: [],
      loading: true,
      error: null,
    });
  });

  /**
   * Verifies: a new module gets an unselected, not-editing, unsaved UI entity.
   * Interacts with: EntityStore.add -> setInitialEntityState.
   * Data: module m1.
   */
  it('creates default UI state for a new module', () => {
    const store = new ModuleStore();

    store.add({ id: 'm1', name: 'vm' });

    expect(initialModuleUiState).toEqual({
      isSelected: false,
      isEditing: false,
      isSaved: false,
    });
    expect(store.ui.getValue().entities['m1']).toEqual({
      id: 'm1',
      ...initialModuleUiState,
    });
  });
});
