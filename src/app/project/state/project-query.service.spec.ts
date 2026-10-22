// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { recordEmissions } from '../../test-utils/record-emissions';
import { ProjectQuery } from './project-query.service';
import { ProjectStore } from './project-store.service';
import { Breadcrumb, ProjectObjectType, Tab } from './project.model';

const crumbs: Breadcrumb[] = [
  { id: 'p1', name: 'Project', type: ProjectObjectType.PROJECT },
  { id: 'f1', name: 'main.tf', type: ProjectObjectType.FILE },
];

function tab(id: string, breadcrumb: Breadcrumb[] = []): Tab {
  return {
    id,
    name: id,
    type: ProjectObjectType.FILE,
    directoryId: 'd1',
    breadcrumb,
  };
}

function setup() {
  const store = new ProjectStore();
  const query = new ProjectQuery(store);
  store.add({ id: 'p1', name: 'Project' });
  return { store, query };
}

describe('ProjectQuery', () => {
  /**
   * Verifies: the sidebar selectors emit the layout defaults and follow
   *   updates to the project's UI state.
   * Interacts with: ui.selectEntity projections.
   * Data: p1 with default UI; then the right sidebar is opened on 'outputs'
   *   at 500px and the left one closed at 200px.
   */
  it('selects the sidebar layout', async () => {
    const { store, query } = setup();
    const rightOpen = recordEmissions(query.getRightSidebarOpen$('p1'));

    expect(await firstValueFrom(query.getRightSidebarView$('p1'))).toBe('');
    expect(await firstValueFrom(query.getRightSidebarWidth('p1'))).toBe(300);
    expect(await firstValueFrom(query.getLeftSidebarOpen('p1'))).toBe(true);
    expect(await firstValueFrom(query.getLeftSidebarWidth('p1'))).toBe(364);

    store.ui.update('p1', {
      rightSidebarOpen: true,
      rightSidebarView: 'outputs',
      rightSidebarWidth: 500,
      leftSidebarOpen: false,
      leftSidebarWidth: 200,
    });

    expect(rightOpen).toEqual([false, true]);
    expect(await firstValueFrom(query.getRightSidebarView$('p1'))).toBe(
      'outputs',
    );
    expect(await firstValueFrom(query.getRightSidebarWidth('p1'))).toBe(500);
    expect(await firstValueFrom(query.getLeftSidebarOpen('p1'))).toBe(false);
    expect(await firstValueFrom(query.getLeftSidebarWidth('p1'))).toBe(200);
  });

  /**
   * Verifies: selectOpenTabs and selectSelectedTab follow the project's tabs.
   * Interacts with: ui.selectEntity(openTabs / selectedTab).
   * Data: p1; two tabs opened with the second selected.
   */
  it('selects the open tabs and the selected tab', () => {
    const { store, query } = setup();
    const tabs = recordEmissions(query.selectOpenTabs('p1'));
    const selected = recordEmissions(query.selectSelectedTab('p1'));

    store.ui.update('p1', { openTabs: [tab('f1'), tab('f2')], selectedTab: 1 });

    expect(tabs.map((ts) => ts.map((t) => t.id))).toEqual([[], ['f1', 'f2']]);
    expect(selected).toEqual([null, 1]);
  });

  /**
   * Verifies: selectTabBreadcrumb emits an open tab's breadcrumb and [] for a
   *   tab that is not open.
   * Interacts with: ui.selectEntity with a find over openTabs.
   * Data: p1 with tab f1 carrying a two-level breadcrumb.
   */
  it('selects a tab breadcrumb, or [] for a closed tab', async () => {
    const { store, query } = setup();
    store.ui.update('p1', { openTabs: [tab('f1', crumbs)] });

    expect(await firstValueFrom(query.selectTabBreadcrumb('p1', 'f1'))).toEqual(
      crumbs,
    );
    expect(
      await firstValueFrom(query.selectTabBreadcrumb('p1', 'nope')),
    ).toEqual([]);
  });

  /**
   * Verifies: selectBreadcrumb emits an open tab's breadcrumb but errors
   *   for a tab that is not open.
   * Interacts with: ui.selectEntity with openTabs.find(...).breadcrumb.
   * Data: p1 with tab f1.
   */
  it('selectBreadcrumb errors for a closed tab', async () => {
    const { store, query } = setup();
    store.ui.update('p1', { openTabs: [tab('f1', crumbs)] });

    expect(await firstValueFrom(query.selectBreadcrumb('p1', 'f1'))).toEqual(
      crumbs,
    );
    await expect(
      firstValueFrom(query.selectBreadcrumb('p1', 'nope')),
    ).rejects.toThrow(TypeError);
  });
});
