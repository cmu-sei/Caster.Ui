// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { DirectoryStore, initialDirectoryUIState } from './directory.store';

// Pure store tests: no TestBed, a fresh store per test.

describe('DirectoryStore', () => {
  /**
   * Verifies: the store registers as 'directories' with a 'UI/directories'
   *   entity UI store, and starts empty and loading.
   * Interacts with: @StoreConfig, EntityStore.createUIStore.
   * Data: a fresh store.
   */
  it('is named directories and starts empty', () => {
    const store = new DirectoryStore();

    expect(store.storeName).toBe('directories');
    expect(store.ui.storeName).toBe('UI/directories');
    expect(store.getValue()).toEqual({
      entities: {},
      ids: [],
      loading: true,
      error: null,
    });
  });

  /**
   * Verifies: a new directory gets a fully collapsed UI entity, and removing
   *   the directory removes its UI entity.
   * Interacts with: EntityStore.add/remove -> UI store creation and removal.
   * Data: directory d1.
   */
  it('creates collapsed UI state for a new directory and removes it with the directory', () => {
    const store = new DirectoryStore();

    store.add({ id: 'd1', name: 'root', projectId: 'p1' });

    expect(initialDirectoryUIState).toEqual({
      isExpanded: false,
      isFilesExpanded: false,
      isWorkspacesExpanded: false,
      isDirectoriesExpanded: false,
      isDesignsExpanded: false,
    });
    expect(store.ui.getValue().entities['d1']).toEqual({
      id: 'd1',
      ...initialDirectoryUIState,
    });

    store.remove('d1');

    expect(store.ui.getValue().ids).toEqual([]);
  });
});
