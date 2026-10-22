// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Workspace } from '../../generated/caster-api';
import { ResourceActions } from './workspace.model';
import {
  initialWorkspaceEntityUiState,
  WorkspaceStore,
} from './workspace.store';

// Pure store tests: no TestBed. Each test builds its own store, so nothing
// leaks through Akita's global store registry (a new instance replaces the
// old one under the same name).

function ws(overrides: Partial<Workspace> = {}): Workspace {
  return { id: 'w1', name: 'Alpha', directoryId: 'd1', runs: [], ...overrides };
}

describe('WorkspaceStore', () => {
  /**
   * Verifies: the store registers as 'workspaces' and its entity UI store as
   *   'UI/workspaces' (the names devtools and persistState key on).
   * Interacts with: @StoreConfig, EntityStore.createUIStore.
   * Data: a fresh store.
   */
  it('is named workspaces, with a UI/workspaces UI store', () => {
    const store = new WorkspaceStore();

    expect(store.storeName).toBe('workspaces');
    expect(store.ui.storeName).toBe('UI/workspaces');
  });

  /**
   * Verifies: a fresh store holds no entities, starts loading, has no error and
   *   no lockingEnabled flag until the API reports one.
   * Interacts with: Akita's initial entity state.
   * Data: a fresh store.
   */
  it('starts empty and loading, with lockingEnabled unset', () => {
    const store = new WorkspaceStore();

    expect(store.getValue()).toEqual({
      entities: {},
      ids: [],
      loading: true,
      error: null,
    });
    expect(store.getValue().lockingEnabled).toBeUndefined();
    expect(store.ui.getValue().ids).toEqual([]);
  });

  /**
   * Verifies: the per-workspace UI defaults are collapsed, nothing selected or
   *   expanded, no status filters, the 'runs' view and no resource action.
   * Interacts with: initialWorkspaceEntityUiState (consumed by the components).
   * Data: the exported constant.
   */
  it('defines collapsed, empty UI defaults on the runs view', () => {
    expect(initialWorkspaceEntityUiState).toEqual({
      isExpanded: false,
      expandedRuns: [],
      expandedResources: [],
      resourceActions: [],
      selectedRuns: [],
      statusFilter: [],
      workspaceView: 'runs',
      resourceAction: ResourceActions.None,
    });
  });

  /**
   * Verifies: adding a workspace creates its UI entity from the initial UI
   *   state, keyed by the workspace id, and clears loading.
   * Interacts with: EntityStore.add -> setInitialEntityState factory.
   * Data: one workspace w1.
   */
  it('creates a default UI entity when a workspace is added', () => {
    const store = new WorkspaceStore();

    store.add(ws());

    expect(store.getValue().ids).toEqual(['w1']);
    expect(store.getValue().loading).toBe(false);
    expect(store.ui.getValue().entities['w1']).toEqual({
      id: 'w1',
      ...initialWorkspaceEntityUiState,
    });
  });

  /**
   * Verifies: adding an id that already exists changes nothing: the stored
   *   entity keeps its runs and its UI state. WorkspaceService.runUpdated relies
   *   on this when it calls add({ id, runs: [] }) for every run event.
   * Interacts with: EntityStore.add.
   * Data: w1 with one run and an expanded UI, then add({ id: 'w1', runs: [] }).
   */
  it('ignores add() for an existing id, keeping its runs and UI state', () => {
    const store = new WorkspaceStore();
    store.add(ws({ runs: [{ id: 'r1', workspaceId: 'w1' }] }));
    store.ui.update('w1', { isExpanded: true });

    store.add({ id: 'w1', runs: [] });

    expect(store.getValue().entities['w1'].runs).toEqual([
      { id: 'r1', workspaceId: 'w1' },
    ]);
    expect(store.ui.getValue().entities['w1'].isExpanded).toBe(true);
  });

  /**
   * Verifies: set() replaces every UI entity with fresh defaults, which drops
   *   UI state such as isExpanded for workspaces that survive the set.
   *   WorkspaceService.setWorkspaces exists to restore it afterwards.
   * Interacts with: EntityStore.set -> handleUICreation (replace mode).
   * Data: w1 expanded, then set([w1, w2]).
   */
  it('resets UI state for every workspace on set()', () => {
    const store = new WorkspaceStore();
    store.add(ws());
    store.ui.update('w1', { isExpanded: true });

    store.set([ws(), ws({ id: 'w2', name: 'Beta' })]);

    expect(store.ui.getValue().ids).toEqual(['w1', 'w2']);
    expect(store.ui.getValue().entities['w1'].isExpanded).toBe(false);
    expect(store.ui.getValue().entities['w2']).toEqual({
      id: 'w2',
      ...initialWorkspaceEntityUiState,
    });
  });

  /**
   * Verifies: upserting an unknown id creates both the entity and its default
   *   UI entity; upserting a known id merges into the entity and leaves its UI
   *   state alone.
   * Interacts with: EntityStore.upsert -> handleUICreation (add mode).
   * Data: upsert new w2; then upsert w1 with a new name after expanding it.
   */
  it('creates UI state on upsert of a new id and keeps it on upsert of a known id', () => {
    const store = new WorkspaceStore();
    store.add(ws());
    store.ui.update('w1', { isExpanded: true });

    store.upsert('w2', { name: 'Beta', runs: [] });
    store.upsert('w1', { name: 'Renamed' });

    expect(store.getValue().entities['w2']).toEqual({
      id: 'w2',
      name: 'Beta',
      runs: [],
    });
    expect(store.ui.getValue().entities['w2']).toEqual({
      id: 'w2',
      ...initialWorkspaceEntityUiState,
    });
    expect(store.getValue().entities['w1'].name).toBe('Renamed');
    expect(store.getValue().entities['w1'].directoryId).toBe('d1');
    expect(store.ui.getValue().entities['w1'].isExpanded).toBe(true);
  });

  /**
   * Verifies: removing a workspace also removes its UI entity.
   * Interacts with: EntityStore.remove -> handleUIRemove.
   * Data: w1 and w2, remove w1.
   */
  it('removes the UI entity with the workspace', () => {
    const store = new WorkspaceStore();
    store.add([ws(), ws({ id: 'w2', name: 'Beta' })]);

    store.remove('w1');

    expect(store.getValue().ids).toEqual(['w2']);
    expect(store.ui.getValue().ids).toEqual(['w2']);
  });

  /**
   * Verifies: updating an id that is not in the store is a silent no-op (no
   *   entity is created). Several WorkspaceService methods depend on this.
   * Interacts with: EntityStore.update(id, fn).
   * Data: an empty store, update('missing', ...).
   */
  it('ignores update() for an id that is not in the store', () => {
    const store = new WorkspaceStore();

    store.update('missing', () => ({ name: 'Ghost' }));

    expect(store.getValue().ids).toEqual([]);
    expect(store.getValue().entities).toEqual({});
  });

  /**
   * Verifies: the root-level lockingEnabled flag updates without touching the
   *   entities.
   * Interacts with: Store.update(state).
   * Data: one workspace, then update({ lockingEnabled: true }).
   */
  it('stores lockingEnabled at the root of the state', () => {
    const store = new WorkspaceStore();
    store.add(ws());

    store.update({ lockingEnabled: true });

    expect(store.getValue().lockingEnabled).toBe(true);
    expect(store.getValue().entities['w1']).toEqual(ws());
  });
});
