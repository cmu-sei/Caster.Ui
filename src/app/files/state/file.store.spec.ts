// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ModelFile } from '../../generated/caster-api';
import { FileStore, initialFileUIState } from './file.store';

// Pure store tests: no TestBed. Each test builds its own store, so nothing
// leaks through Akita's global store registry.

function file(overrides: Partial<ModelFile> = {}): ModelFile {
  return { id: 'f1', name: 'main.tf', directoryId: 'd1', ...overrides };
}

describe('FileStore', () => {
  /**
   * Verifies: the store registers as 'files' with a 'UI/files' entity UI store.
   * Interacts with: @StoreConfig, EntityStore.createUIStore.
   * Data: a fresh store.
   */
  it('is named files, with a UI/files UI store', () => {
    const store = new FileStore();

    expect(store.storeName).toBe('files');
    expect(store.ui.storeName).toBe('UI/files');
  });

  /**
   * Verifies: a fresh store holds no files, starts loading and has no active file.
   * Interacts with: Akita's initial entity state.
   * Data: a fresh store.
   */
  it('starts empty and loading, with no active file', () => {
    const store = new FileStore();

    expect(store.getValue()).toEqual({
      entities: {},
      ids: [],
      loading: true,
      error: null,
    });
    expect(store.getValue().active).toBeUndefined();
  });

  /**
   * Verifies: the per-file UI defaults are "saved" with no selected version.
   * Interacts with: initialFileUIState (read by the editor).
   * Data: the exported constant.
   */
  it('defines saved, no-version UI defaults', () => {
    expect(initialFileUIState).toEqual({
      isSaved: true,
      selectedVersionId: '',
    });
  });

  /**
   * Verifies: adding a file creates its UI entity from the defaults, and
   *   removing it drops the UI entity too.
   * Interacts with: EntityStore.add/remove -> UI store creation and removal.
   * Data: files f1 and f2; then remove f1.
   */
  it('creates and removes UI entities with the files', () => {
    const store = new FileStore();

    store.add([file(), file({ id: 'f2', name: 'vars.tf' })]);

    expect(store.ui.getValue().entities['f1']).toEqual({
      id: 'f1',
      ...initialFileUIState,
    });

    store.remove('f1');

    expect(store.getValue().ids).toEqual(['f2']);
    expect(store.ui.getValue().ids).toEqual(['f2']);
  });
});
