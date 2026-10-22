// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import {
  ArchiveType,
  ImportProjectResult,
  ModelFile,
  Project,
  ProjectsService,
  VlansService,
  Workspace,
} from '../../generated/caster-api';
import { DesignStore } from '../../designs/state/design.store';
import { DirectoryStore } from '../../directories/state/directory.store';
import { FileStore } from '../../files/state/file.store';
import { WorkspaceStore } from '../../workspace/state/workspace.store';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { downloadResponse } from '../../test-utils/download-response';
import { recordEmissions } from '../../test-utils/record-emissions';
import { ProjectQuery } from './project-query.service';
import { initialProjectUIState, ProjectStore } from './project-store.service';
import { Breadcrumb, ProjectObjectType, Tab } from './project.model';
import { ProjectService } from './project.service';

const { PROJECT, DIRECTORY, FILE, WORKSPACE, DESIGN } = ProjectObjectType;

function project(overrides: Partial<Project> = {}): Project {
  return { id: 'p1', name: 'Project', description: 'desc', ...overrides };
}

function tab(
  id: string,
  type: ProjectObjectType = FILE,
  breadcrumb?: Breadcrumb[],
): Tab {
  return { id, name: id, type, directoryId: 'd1', breadcrumb };
}

const crumb = (
  id: string,
  name: string,
  type: ProjectObjectType,
): Breadcrumb => ({
  id,
  name,
  type,
});

interface Apis {
  projects?: ApiStub<ProjectsService>;
  vlans?: ApiStub<VlansService>;
}

/**
 * Real ProjectService with the real project, directory, file, workspace and
 * design stores and queries; only ProjectsService and VlansService are
 * stubbed.
 */
function setup(apis: Apis = {}, projects: Project[] = []) {
  const overrides: Provider[] = [];
  if (apis.projects)
    overrides.push({ provide: ProjectsService, useValue: apis.projects });
  if (apis.vlans)
    overrides.push({ provide: VlansService, useValue: apis.vlans });
  TestBed.configureTestingModule({ providers: getDefaultProviders(overrides) });
  const store = TestBed.inject(ProjectStore);
  const query = TestBed.inject(ProjectQuery);
  const service = TestBed.inject(ProjectService);
  store.add(projects);
  return { service, store, query };
}

/** setup() with p1 active and the given tabs open. */
function withTabs(tabs: Tab[], selectedTab: number) {
  const ctx = setup({}, [project()]);
  ctx.store.setActive('p1');
  ctx.store.ui.update('p1', { openTabs: tabs, selectedTab });
  const ui = () => ctx.query.ui.getEntity('p1');
  const tabIds = () => ui().openTabs.map((t) => t.id);
  return { ...ctx, ui, tabIds };
}

describe('ProjectService', () => {
  describe('loading and editing projects', () => {
    /**
     * Verifies: loadProjects passes onlyMine, replaces the projects, keeps
     *   the UI (open tabs, layout) of projects still present, gives new ones
     *   defaults and drops removed ones.
     * Interacts with: ProjectsService.getAllProjects (stub); ProjectStore.set
     *   + ui.upsert.
     * Data: stored p1 (two open tabs) and p3; the API returns p1 and p2.
     */
    it('loadProjects() replaces the projects and keeps surviving UI state', async () => {
      const api = {
        getAllProjects: vi.fn(() =>
          of([
            project({ name: 'Renamed' }),
            project({ id: 'p2', name: 'Two' }),
          ]),
        ),
      } satisfies ApiStub<ProjectsService>;
      const { service, store, query } = setup({ projects: api }, [
        project(),
        project({ id: 'p3', name: 'Three' }),
      ]);
      store.ui.update('p1', {
        openTabs: [tab('f1'), tab('f2')],
        selectedTab: 1,
      });

      await firstValueFrom(service.loadProjects(true));

      expect(api.getAllProjects).toHaveBeenCalledWith(true);
      expect(query.getAll().map((p) => p.id)).toEqual(['p1', 'p2']);
      expect(query.getEntity('p1').name).toBe('Renamed');
      expect(query.ui.getEntity('p1')).toMatchObject({ selectedTab: 1 });
      expect(query.ui.getEntity('p1').openTabs).toHaveLength(2);
      expect(query.ui.getEntity('p2')).toEqual({
        id: 'p2',
        ...initialProjectUIState,
      });
      expect(query.ui.hasEntity('p3')).toBe(false);
    });

    /**
     * Verifies: loadProject and updateProject upsert the project and keep
     *   its UI state; a newly loaded project gets the default UI state.
     * Interacts with: ProjectsService.getProject/editProject (stubs).
     * Data: stored p1 with the right sidebar open; load p1 and new p2; edit p1.
     */
    it('loadProject() and updateProject() upsert and keep UI state', async () => {
      const api = {
        getProject: vi.fn((id: string) =>
          of(project({ id, name: `Loaded ${id}` })),
        ),
        editProject: vi.fn(() => of(project({ name: 'Edited' }))),
      } satisfies ApiStub<ProjectsService>;
      const { service, store, query } = setup({ projects: api }, [project()]);
      store.ui.update('p1', { rightSidebarOpen: true });

      await firstValueFrom(service.loadProject('p1'));
      await firstValueFrom(service.loadProject('p2'));
      expect(query.getEntity('p1').name).toBe('Loaded p1');
      expect(query.ui.getEntity('p2')).toEqual({
        id: 'p2',
        ...initialProjectUIState,
      });

      await firstValueFrom(service.updateProject(project({ name: 'Edited' })));

      expect(api.editProject).toHaveBeenCalledWith(
        'p1',
        project({ name: 'Edited' }),
      );
      expect(query.getEntity('p1').name).toBe('Edited');
      expect(query.ui.getEntity('p1').rightSidebarOpen).toBe(true);
    });

    /**
     * Verifies: createProject adds the created project with default UI
     *   state; deleteProject removes a project and its UI state.
     * Interacts with: ProjectsService.createProject/deleteProject (stubs).
     * Data: create p2; then delete p1.
     */
    it('createProject() and deleteProject()', async () => {
      const api = {
        createProject: vi.fn(() => of(project({ id: 'p2', name: 'New' }))),
        deleteProject: vi.fn(() => of(undefined)),
      } satisfies ApiStub<ProjectsService>;
      const { service, query } = setup({ projects: api }, [project()]);

      await firstValueFrom(
        service.createProject(project({ id: undefined, name: 'New' })),
      );
      expect(query.ui.getEntity('p2')).toEqual({
        id: 'p2',
        ...initialProjectUIState,
      });

      await firstValueFrom(service.deleteProject('p1'));

      expect(api.deleteProject).toHaveBeenCalledWith('p1');
      expect(query.getAll().map((p) => p.id)).toEqual(['p2']);
      expect(query.ui.hasEntity('p1')).toBe(false);
    });
  });

  describe('API errors', () => {
    /**
     * Verifies: a failed deleteProject passes the API error to the subscriber
     *   and keeps the project and its UI state.
     * Interacts with: ProjectsService.deleteProject (stub, failing);
     *   ProjectStore, ProjectQuery (real).
     * Data: stored p1 with two open tabs; the API fails with a 403.
     */
    it('keeps the project when deleteProject() fails', async () => {
      const forbidden = new Error('403 Forbidden');
      const api = {
        deleteProject: vi.fn(() => throwError(() => forbidden)),
      } satisfies ApiStub<ProjectsService>;
      const { service, store, query } = setup({ projects: api }, [project()]);
      store.ui.update('p1', { openTabs: [tab('f1'), tab('f2')] });

      await expect(firstValueFrom(service.deleteProject('p1'))).rejects.toBe(
        forbidden,
      );

      expect(query.getAll().map((p) => p.id)).toEqual(['p1']);
      expect(query.ui.getEntity('p1').openTabs).toHaveLength(2);
    });
  });

  describe('openTab and setSelectedTab', () => {
    /**
     * Verifies: opening an object that has no tab appends a tab (without a
     *   breadcrumb) and selects it.
     * Interacts with: ProjectQuery.getActive + ui.getEntity; ui.upsert.
     * Data: active p1 with tab f1; open workspace w1.
     */
    it('appends and selects a new tab', () => {
      const { service, ui, tabIds } = withTabs([tab('f1')], 0);
      const workspace = {
        id: 'w1',
        name: 'dev',
        directoryId: 'd2',
        runs: [],
      } as Workspace;

      service.openTab(workspace, WORKSPACE);

      expect(tabIds()).toEqual(['f1', 'w1']);
      expect(ui().openTabs[1]).toEqual({
        id: 'w1',
        name: 'dev',
        type: WORKSPACE,
        directoryId: 'd2',
      });
      expect(ui().selectedTab).toBe(1);
    });

    /**
     * Verifies: opening an object whose tab is open selects that tab, and
     *   writes nothing when it is already selected.
     * Interacts with: ProjectStore.ui.upsert (emission count).
     * Data: active p1 with tabs f1, f2 (f1 selected); open f2, then f2 again.
     */
    it('selects an existing tab instead of opening another', () => {
      const { service, query, ui, tabIds } = withTabs(
        [tab('f1'), tab('f2')],
        0,
      );
      const writes = recordEmissions(query.ui.selectEntity('p1'));
      const f2: ModelFile = { id: 'f2', name: 'f2', directoryId: 'd1' };

      service.openTab(f2, FILE);
      service.openTab(f2, FILE);

      expect(tabIds()).toEqual(['f1', 'f2']);
      expect(ui().selectedTab).toBe(1);
      expect(writes).toHaveLength(2);
    });

    /**
     * Verifies: setSelectedTab changes the active project's selected tab.
     * Interacts with: ProjectQuery.getActive; ui.upsert.
     * Data: active p1 with tabs f1, f2 (f1 selected); select index 1.
     */
    it('setSelectedTab() selects a tab of the active project', () => {
      const { service, ui } = withTabs([tab('f1'), tab('f2')], 0);

      service.setSelectedTab(1);

      expect(ui().selectedTab).toBe(1);
    });

    /**
     * Verifies: tab operations do nothing when no project is active.
     * Interacts with: ProjectQuery.getActive (undefined).
     * Data: stored p1 with one tab, not active.
     */
    it('ignores tab operations without an active project', () => {
      const { service, store, query } = setup({}, [project()]);
      store.ui.update('p1', { openTabs: [tab('f1')], selectedTab: 0 });

      service.openTab({ id: 'f2', name: 'f2' }, FILE);
      service.setSelectedTab(3);
      service.closeTab('f1');
      service.updateTabBreadcrumb('f1', [crumb('p1', 'Project', PROJECT)]);

      expect(query.ui.getEntity('p1')).toMatchObject({
        openTabs: [tab('f1')],
        selectedTab: 0,
      });
    });
  });

  describe('closeTab', () => {
    /**
     * Verifies: closing a tab removes it and keeps the selected index, unless
     *   that index is now past the end, in which case the last tab is
     *   selected.
     * Interacts with: ProjectStore.ui.upsert.
     * Data: tabs f1, f2, f3 with f3 selected; close f1, then f3.
     */
    it('removes the tab and clamps the selection', () => {
      const { service, ui, tabIds } = withTabs(
        [tab('f1'), tab('f2'), tab('f3')],
        2,
      );

      service.closeTab('f1');
      expect(tabIds()).toEqual(['f2', 'f3']);
      expect(ui().selectedTab).toBe(1);

      service.closeTab('f3');
      expect(tabIds()).toEqual(['f2']);
      expect(ui().selectedTab).toBe(0);
    });

    /**
     * Verifies: closing an id that has no tab removes the last tab.
     * Interacts with: Array.splice(findIndex(...) = -1, 1).
     * Data: tabs f1, f2, f3; close 'not-open'.
     */
    it('removes the last tab for an id that is not open', () => {
      const { service, tabIds } = withTabs(
        [tab('f1'), tab('f2'), tab('f3')],
        0,
      );

      service.closeTab('not-open');

      expect(tabIds()).toEqual(['f1', 'f2']);
    });
  });

  describe('pruneDeletedTabs', () => {
    /**
     * Verifies: drops file, workspace, design and directory tabs whose entity
     *   is no longer in its store, keeps other tab types, and clamps the
     *   selected index.
     * Interacts with: FileQuery, WorkspaceQuery, DesignQuery and
     *   DirectoryQuery hasEntity (real stores).
     * Data: tabs f1 (stored), f2 (gone), w1 (gone), g1 (stored), d1 (stored),
     *   p1 (project tab) with the last one selected.
     */
    it('drops tabs whose object is gone', () => {
      const { service, ui, tabIds } = withTabs(
        [
          tab('f1'),
          tab('f2'),
          tab('w1', WORKSPACE),
          tab('g1', DESIGN),
          tab('d1', DIRECTORY),
          tab('p1', PROJECT),
        ],
        5,
      );
      TestBed.inject(FileStore).add({ id: 'f1', name: 'main.tf' });
      TestBed.inject(DesignStore).add({ id: 'g1', name: 'Design' });
      TestBed.inject(DirectoryStore).add({ id: 'd1', name: 'root' });

      service.pruneDeletedTabs('p1');

      expect(tabIds()).toEqual(['f1', 'g1', 'd1', 'p1']);
      expect(ui().selectedTab).toBe(3);
    });

    /**
     * Verifies: when every tab's object still exists, nothing is written;
     *   an unknown project or one without tabs is ignored.
     * Interacts with: ProjectStore.ui.upsert (emission count).
     * Data: tab w1 with workspace w1 stored; projects 'missing' and p2.
     */
    it('writes nothing when no tab is stale', () => {
      const { service, store, query } = withTabs([tab('w1', WORKSPACE)], 0);
      TestBed.inject(WorkspaceStore).add({ id: 'w1', name: 'dev', runs: [] });
      store.add(project({ id: 'p2' }));
      const writes = recordEmissions(query.ui.selectEntity('p1'));

      service.pruneDeletedTabs('p1');
      service.pruneDeletedTabs('missing');
      service.pruneDeletedTabs('p2');

      expect(writes).toHaveLength(1);
    });
  });

  describe('updateTabBreadcrumb', () => {
    const before = [
      crumb('p1', 'Project', PROJECT),
      crumb('f1', 'main.tf', FILE),
    ];

    /**
     * Verifies: a tab without a breadcrumb gets the new one; other tabs are
     *   kept.
     * Interacts with: ProjectStore.ui.upsert.
     * Data: tabs f1 (no breadcrumb) and f2.
     */
    it('sets the breadcrumb of a tab that has none', () => {
      const { service, ui } = withTabs([tab('f1'), tab('f2')], 0);

      service.updateTabBreadcrumb('f1', before);

      expect(ui().openTabs).toEqual([tab('f1', FILE, before), tab('f2')]);
    });

    /**
     * Verifies: a same-length breadcrumb with a changed name replaces the old
     *   one; an identical breadcrumb writes nothing.
     * Interacts with: ProjectStore.ui.upsert (emission count).
     * Data: tab f1 with [Project, main.tf]; update with [Project, renamed.tf],
     *   then the same again.
     */
    it('replaces a changed breadcrumb of the same depth', () => {
      const { service, query, ui } = withTabs([tab('f1', FILE, before)], 0);
      const renamed = [
        crumb('p1', 'Project', PROJECT),
        crumb('f1', 'renamed.tf', FILE),
      ];
      const writes = recordEmissions(query.ui.selectEntity('p1'));

      service.updateTabBreadcrumb('f1', renamed);
      service.updateTabBreadcrumb('f1', [...renamed]);

      expect(ui().openTabs[0].breadcrumb).toEqual(renamed);
      expect(writes).toHaveLength(2);
    });

    /**
     * Verifies: a breadcrumb of a different depth is not applied.
     * Interacts with: updateTabBreadcrumb's length comparison.
     * Data: tab f1 with [Project, main.tf]; the file moved into directory d1.
     */
    it('ignores a breadcrumb of a different depth', () => {
      const { service, ui } = withTabs([tab('f1', FILE, before)], 0);
      const moved = [
        crumb('p1', 'Project', PROJECT),
        crumb('d1', 'root', DIRECTORY),
        crumb('f1', 'main.tf', FILE),
      ];

      service.updateTabBreadcrumb('f1', moved);

      expect(ui().openTabs[0].breadcrumb).toEqual(before);
    });
  });

  describe('createBreadcrumb', () => {
    function seedDirectories() {
      TestBed.inject(DirectoryStore).add([
        { id: 'd1', name: 'root', parentId: null },
        { id: 'd2', name: 'child', parentId: 'd1' },
      ]);
    }

    /**
     * Verifies: a file's breadcrumb runs project > each parent directory >
     *   file.
     * Interacts with: DirectoryQuery.getEntity walk over parentId.
     * Data: file f1 in d2, whose parent is d1; workspaceId null.
     */
    it('walks the directory chain for a file', () => {
      const { service } = setup();
      seedDirectories();
      const file: ModelFile = {
        id: 'f1',
        name: 'main.tf',
        directoryId: 'd2',
        workspaceId: null,
      };

      expect(service.createBreadcrumb(project(), file, FILE)).toEqual([
        crumb('p1', 'Project', PROJECT),
        crumb('d1', 'root', DIRECTORY),
        crumb('d2', 'child', DIRECTORY),
        crumb('f1', 'main.tf', FILE),
      ]);
    });

    /**
     * Verifies: a workspace file gets its workspace between the directories
     *   and the file; an unknown workspace is skipped.
     * Interacts with: WorkspaceQuery.getEntity.
     * Data: file f1 in d1 belonging to workspace w1; file f2 belonging to
     *   unknown w9.
     */
    it('adds the workspace for a workspace file', () => {
      const { service } = setup();
      seedDirectories();
      TestBed.inject(WorkspaceStore).add({
        id: 'w1',
        name: 'dev',
        directoryId: 'd1',
        runs: [],
      });

      expect(
        service.createBreadcrumb(
          project(),
          {
            id: 'f1',
            name: 'terraform.tfstate',
            directoryId: 'd1',
            workspaceId: 'w1',
          },
          FILE,
        ),
      ).toEqual([
        crumb('p1', 'Project', PROJECT),
        crumb('d1', 'root', DIRECTORY),
        crumb('w1', 'dev', WORKSPACE),
        crumb('f1', 'terraform.tfstate', FILE),
      ]);
      expect(
        service
          .createBreadcrumb(
            project(),
            { id: 'f2', name: 'x', directoryId: 'd1', workspaceId: 'w9' },
            FILE,
          )
          .map((b) => b.id),
      ).toEqual(['p1', 'd1', 'f2']);
    });

    /**
     * Verifies: a workspace's breadcrumb is project > directories >
     *   workspace.
     * Interacts with: DirectoryQuery.getEntity.
     * Data: workspace w1 in d2.
     */
    it('builds a workspace breadcrumb', () => {
      const { service } = setup();
      seedDirectories();
      const workspace = {
        id: 'w1',
        name: 'dev',
        directoryId: 'd2',
        runs: [],
      } as Workspace;

      expect(
        service
          .createBreadcrumb(project(), workspace, WORKSPACE)
          .map((b) => b.id),
      ).toEqual(['p1', 'd1', 'd2', 'w1']);
    });
  });

  describe('sidebars', () => {
    /**
     * Verifies: each sidebar setter writes its own field of the project's UI
     *   state.
     * Interacts with: ProjectStore.ui.upsert; ProjectQuery sidebar selectors.
     * Data: stored p1 with the default layout.
     */
    it('stores the sidebar layout', () => {
      const { service, query } = setup({}, [project()]);

      service.setRightSidebarOpen('p1', true);
      service.setRightSidebarView('p1', 'outputs');
      service.setRightSidebarWidth('p1', 480);
      service.setLeftSidebarOpen('p1', false);
      service.setLeftSidebarWidth('p1', 250);

      expect(query.ui.getEntity('p1')).toMatchObject({
        rightSidebarOpen: true,
        rightSidebarView: 'outputs',
        rightSidebarWidth: 480,
        leftSidebarOpen: false,
        leftSidebarWidth: 250,
      });
    });
  });

  describe('export, import and partitions', () => {
    /**
     * Verifies: export requests the project archive as a full response and
     *   returns the blob and file name; import forwards the archive.
     * Interacts with: ProjectsService.exportProject ('response' overload) and
     *   importProject (stubs).
     * Data: export p1 as zip without ids ('Project.zip'); import a Blob.
     */
    it('exports and imports project archives', async () => {
      const response = downloadResponse('Project.zip');
      const result: ImportProjectResult = { lockedFiles: ['f1'] };
      const api = {
        exportProject: vi.fn(
          (
            _id: string,
            _type?: ArchiveType,
            _ids?: boolean,
            _observe?: 'response',
          ) => of(response),
        ),
        importProject: vi.fn(() => of(result)),
      } satisfies ApiStub<ProjectsService>;
      const { service } = setup({ projects: api });
      const archive = new Blob(['zip']);

      expect(
        await firstValueFrom(service.export('p1', ArchiveType.Zip, false)),
      ).toEqual({
        blob: response.body,
        filename: 'Project.zip',
      });
      expect(api.exportProject).toHaveBeenCalledWith(
        'p1',
        'zip',
        false,
        'response',
      );
      expect(await firstValueFrom(service.import('p1', true, archive))).toBe(
        result,
      );
      expect(api.importProject).toHaveBeenCalledWith('p1', true, archive);
    });

    /**
     * Verifies: assignPartition assigns when given a partition id and
     *   unassigns when not, upserting the returned project each time.
     * Interacts with: VlansService.assignPartition/unassignPartition (stubs).
     * Data: stored p1; assign pa1, then unassign.
     */
    it('assignPartition() assigns or unassigns the project partition', async () => {
      const assigned$ = new Subject<Project>();
      const api = {
        assignPartition: vi.fn(() => assigned$),
        unassignPartition: vi.fn(() => of(project({ partitionId: null }))),
      } satisfies ApiStub<VlansService>;
      const { service, query } = setup({ vlans: api }, [project()]);

      recordEmissions(service.assignPartition('p1', 'pa1'));
      expect(api.assignPartition).toHaveBeenCalledWith('pa1', {
        projectId: 'p1',
      });
      assigned$.next(project({ partitionId: 'pa1' }));
      expect(query.getEntity('p1').partitionId).toBe('pa1');

      await firstValueFrom(service.assignPartition('p1', null));

      expect(api.unassignPartition).toHaveBeenCalledWith({ projectId: 'p1' });
      expect(query.getEntity('p1').partitionId).toBeNull();
    });
  });
});
