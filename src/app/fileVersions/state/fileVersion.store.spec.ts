// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  FileVersionStore,
  initialFileVersionUiState,
} from './fileVersion.store';

describe('FileVersionStore', () => {
  /**
   * Verifies: the store registers as 'fileVersions', and a new version gets
   *   an unselected UI entity.
   * Interacts with: @StoreConfig, EntityStore.add -> setInitialEntityState.
   * Data: version fv1.
   */
  it('is named fileVersions and creates unselected UI state', () => {
    const store = new FileVersionStore();

    store.add({ id: 'fv1', fileId: 'f1', name: 'main.tf' });

    expect(store.storeName).toBe('fileVersions');
    expect(store.ui.storeName).toBe('UI/fileVersions');
    expect(initialFileVersionUiState).toEqual({ isSelected: false });
    expect(store.ui.getValue().entities['fv1']).toEqual({
      id: 'fv1',
      isSelected: false,
    });
  });
});
