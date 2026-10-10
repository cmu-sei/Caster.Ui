// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { initialProjectUIState, ProjectStore } from './project-store.service';

describe('ProjectStore', () => {
  /**
   * Verifies: the store registers as 'projects' with a 'UI/projects' UI
   *   store, and starts empty and loading.
   * Interacts with: @StoreConfig, EntityStore.createUIStore.
   * Data: a fresh store.
   */
  it('is named projects and starts empty', () => {
    const store = new ProjectStore();

    expect(store.storeName).toBe('projects');
    expect(store.ui.storeName).toBe('UI/projects');
    expect(store.getValue()).toEqual({
      entities: {},
      ids: [],
      loading: true,
      error: null,
    });
  });

  /**
   * Verifies: a new project gets no open tabs, no selected tab, a closed
   *   300px right sidebar and an open 364px left sidebar.
   * Interacts with: EntityStore.add -> setInitialEntityState.
   * Data: project p1.
   */
  it('creates default layout UI state for a new project', () => {
    const store = new ProjectStore();

    store.add({ id: 'p1', name: 'Project' });

    expect(initialProjectUIState).toEqual({
      openTabs: [],
      selectedTab: null,
      rightSidebarOpen: false,
      rightSidebarView: '',
      rightSidebarWidth: 300,
      leftSidebarOpen: true,
      leftSidebarWidth: 364,
    });
    expect(store.ui.getValue().entities['p1']).toEqual({
      id: 'p1',
      ...initialProjectUIState,
    });
  });
});
