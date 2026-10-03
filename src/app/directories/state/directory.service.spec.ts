// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import {
  ArchiveType,
  Design,
  DirectoriesService,
  Directory,
  ImportDirectoryResult,
  ModelFile,
  Workspace,
} from '../../generated/caster-api';
import { DesignQuery } from '../../designs/state/design.query';
import { DesignStore } from '../../designs/state/design.store';
import { FileQuery } from '../../files/state/file.query';
import { FileStore } from '../../files/state/file.store';
import { WorkspaceQuery } from '../../workspace/state/workspace.query';
import { WorkspaceStore } from '../../workspace/state/workspace.store';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { downloadResponse } from '../../test-utils/download-response';
import { recordEmissions } from '../../test-utils/record-emissions';
import { DirectoryUI } from './directory.model';
import { DirectoryQuery } from './directory.query';
import { DirectoryService } from './directory.service';
import { DirectoryStore, initialDirectoryUIState } from './directory.store';

function dir(overrides: Partial<Directory> = {}): Directory {
  return {
    id: 'd1',
    name: 'root',
    projectId: 'p1',
    parentId: null,
    ...overrides,
  };
}

/**
 * Real DirectoryService with the real file, workspace and design state it
 * fans out to; only DirectoriesService is stubbed.
 */
function setup(
  directoriesApi: ApiStub<DirectoriesService> = {},
  directories: Directory[] = [],
) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: DirectoriesService, useValue: directoriesApi },
    ]),
  });
  const store = TestBed.inject(DirectoryStore);
  const query = TestBed.inject(DirectoryQuery);
  const service = TestBed.inject(DirectoryService);
  store.add(directories);
  return { service, store, query };
}

const boom = () => throwError(() => new Error('boom'));

describe('DirectoryService', () => {
  describe('loadDirectories', () => {
    const fileA: ModelFile = { id: 'f1', name: 'main.tf', directoryId: 'd1' };
    const fileB: ModelFile = { id: 'f2', name: 'vars.tf', directoryId: 'd2' };
    const workspace = { id: 'w1', name: 'dev', directoryId: 'd1' } as Workspace;
    const design: Design = { id: 'g1', name: 'Design', directoryId: 'd2' };

    /**
     * Verifies: requests the project's directories with descendants and
     *   related data but no file content, stores them, and hands their files,
     *   workspaces and designs to the file, workspace and design stores.
     * Interacts with: DirectoriesService.getDirectoriesByProject (stub); real
     *   FileService, WorkspaceService and DesignService state.
     * Data: d1 with one file and one workspace; d2 with one file and one design.
     */
    it('stores the directories and fans out their files, workspaces and designs', async () => {
      const directoriesApi = {
        getDirectoriesByProject: vi.fn(() =>
          of([
            dir({ files: [fileA], workspaces: [workspace], designs: [] }),
            dir({
              id: 'd2',
              name: 'child',
              parentId: 'd1',
              files: [fileB],
              workspaces: [],
              designs: [design],
            }),
          ]),
        ),
      } satisfies ApiStub<DirectoriesService>;
      const { service, query } = setup(directoriesApi);

      await firstValueFrom(service.loadDirectories('p1'));

      expect(directoriesApi.getDirectoriesByProject).toHaveBeenCalledWith(
        'p1',
        true,
        true,
        false,
      );
      expect(query.getAll().map((d) => d.id)).toEqual(['d2', 'd1']);
      const files = TestBed.inject(FileQuery);
      expect(files.getAll().map((f) => f.id)).toEqual(['f1', 'f2']);
      expect(files.isSaved('f1')).toBe(true);
      expect(TestBed.inject(WorkspaceQuery).getEntity('w1')).toEqual(workspace);
      expect(TestBed.inject(DesignQuery).getAll()).toEqual([design]);
    });

    /**
     * Verifies: reloading keeps the UI state of directories that are still
     *   present, gives new ones the defaults and drops the UI of removed ones;
     *   workspaces and designs are replaced, but files are only upserted.
     * Interacts with: DirectoryStore.set + ui.upsert; WorkspaceStore.set;
     *   DesignStore.set; FileStore.upsert.
     * Data: stored d1 (expanded) and d3; stale file f9, workspace w9 and
     *   design g9; the API returns d1 and new d2 with no related items.
     */
    it('restores UI state on reload and replaces workspaces and designs, not files', async () => {
      const directoriesApi = {
        getDirectoriesByProject: vi.fn(() =>
          of([
            dir({ files: [], workspaces: [], designs: [] }),
            dir({
              id: 'd2',
              name: 'new',
              files: [],
              workspaces: [],
              designs: [],
            }),
          ]),
        ),
      } satisfies ApiStub<DirectoriesService>;
      const { service, store, query } = setup(directoriesApi, [
        dir(),
        dir({ id: 'd3', name: 'gone' }),
      ]);
      store.ui.update('d1', { isExpanded: true, isFilesExpanded: true });
      TestBed.inject(FileStore).add({ id: 'f9', name: 'old.tf' });
      TestBed.inject(WorkspaceStore).add({ id: 'w9', name: 'old', runs: [] });
      TestBed.inject(DesignStore).add({ id: 'g9', name: 'old' });

      await firstValueFrom(service.loadDirectories('p1'));

      expect(query.ui.getEntity('d1')).toMatchObject({
        isExpanded: true,
        isFilesExpanded: true,
      });
      expect(query.ui.getEntity('d2')).toEqual({
        id: 'd2',
        ...initialDirectoryUIState,
      });
      expect(query.ui.hasEntity('d3')).toBe(false);
      expect(TestBed.inject(WorkspaceQuery).getCount()).toBe(0);
      expect(TestBed.inject(DesignQuery).getCount()).toBe(0);
      // NOTE: files from directories that are gone (or from another project)
      // stay in the file store; filesUpdated only upserts.
      expect(TestBed.inject(FileQuery).hasEntity('f9')).toBe(true);
    });

    /**
     * Verifies: a directory payload without a related list (null, as the API
     *   sends when related data is not included) makes the fan-out throw.
     * Interacts with: Array.concat(null) -> FileService.filesUpdated.
     * Data: the API returns d1 with files: null.
     */
    it('fails when a directory has no files list', async () => {
      const { service } = setup({
        getDirectoriesByProject: vi.fn(() =>
          of([dir({ files: null, workspaces: [], designs: [] })]),
        ),
      });

      const error = await firstValueFrom(service.loadDirectories('p1')).catch(
        (e: unknown) => e,
      );

      // NOTE: loadDirectories always asks for related data, so the API sends
      // arrays; concat(null) would push a null file and upsertFile reads null.id.
      expect(error).toBeInstanceOf(TypeError);
    });
  });

  describe('add', () => {
    /**
     * Verifies: creates the directory, stores the response with default UI
     *   state, and copies the directory's own fields into its UI entity.
     * Interacts with: DirectoriesService.createDirectory (stub);
     *   DirectoryQuery.getEntity; DirectoryStore.ui.upsert.
     * Data: new directory 'child' under d1; the API returns d2.
     */
    it('creates the directory and stores it', () => {
      const created = dir({ id: 'd2', name: 'child', parentId: 'd1' });
      const directoriesApi = {
        createDirectory: vi.fn(() => of(created)),
      } satisfies ApiStub<DirectoriesService>;
      const { service, query } = setup(directoriesApi);
      const input = dir({ id: undefined, name: 'child', parentId: 'd1' });

      service.add(input);

      expect(directoriesApi.createDirectory).toHaveBeenCalledWith(input);
      expect(query.getEntity('d2')).toEqual(created);
      expect(query.ui.getEntity('d2')).toEqual({
        ...initialDirectoryUIState,
        ...created,
      });
    });
  });

  describe('update and partialUpdate', () => {
    /**
     * Verifies: update sends the whole directory to editDirectory and merges
     *   the response; partialUpdate sends only the given fields.
     * Interacts with: DirectoriesService.editDirectory/partialEditDirectory
     *   (stubs).
     * Data: stored d1; update renames it, partialUpdate sets terraformVersion.
     */
    it('edits the directory and merges the response', () => {
      const directoriesApi = {
        editDirectory: vi.fn(() => of(dir({ name: 'renamed' }))),
        partialEditDirectory: vi.fn(() =>
          of(dir({ name: 'renamed', terraformVersion: '1.9.0' })),
        ),
      } satisfies ApiStub<DirectoriesService>;
      const { service, query } = setup(directoriesApi, [dir()]);

      service.update(dir({ name: 'renamed' }));
      expect(directoriesApi.editDirectory).toHaveBeenCalledWith(
        'd1',
        dir({ name: 'renamed' }),
      );
      expect(query.getEntity('d1').name).toBe('renamed');

      service.partialUpdate('d1', { terraformVersion: '1.9.0' });
      expect(directoriesApi.partialEditDirectory).toHaveBeenCalledWith('d1', {
        terraformVersion: '1.9.0',
      });
      expect(query.getEntity('d1').terraformVersion).toBe('1.9.0');
    });
  });

  describe('delete, updated and deleted', () => {
    /**
     * Verifies: delete removes the directory and its UI state only when the
     *   API succeeds.
     * Interacts with: DirectoriesService.deleteDirectory (Subject stub).
     * Data: stored d1; the response is held back, then delivered.
     */
    it('delete() removes the directory after the API succeeds', () => {
      const response$ = new Subject<void>();
      const directoriesApi = {
        deleteDirectory: vi.fn(() => response$),
      } satisfies ApiStub<DirectoriesService>;
      const { service, query } = setup(directoriesApi, [dir()]);

      recordEmissions(service.delete('d1'));
      expect(query.hasEntity('d1')).toBe(true);

      response$.next();

      expect(query.hasEntity('d1')).toBe(false);
      expect(query.ui.hasEntity('d1')).toBe(false);
    });

    /**
     * Verifies: a rejected delete keeps the directory and reaches the
     *   subscriber.
     * Interacts with: DirectoriesService.deleteDirectory (throwError stub).
     * Data: stored d1; the API errors with 'boom'.
     */
    it('delete() keeps the directory when the API fails', async () => {
      const { service, query } = setup({ deleteDirectory: vi.fn(boom) }, [
        dir(),
      ]);

      const error = await firstValueFrom(service.delete('d1')).catch(
        (e: unknown) => e,
      );

      expect(error).toEqual(new Error('boom'));
      expect(query.hasEntity('d1')).toBe(true);
    });

    /**
     * Verifies: updated() (DirectoryCreated/DirectoryUpdated) upserts, and
     *   deleted() (DirectoryDeleted) removes the directory and its UI state.
     * Interacts with: DirectoryStore.upsert/remove.
     * Data: stored d1 (expanded); events rename d1, add d2, delete d1.
     */
    it('applies hub upserts and deletions', () => {
      const { service, store, query } = setup({}, [dir()]);
      store.ui.update('d1', { isExpanded: true });

      service.updated(dir({ name: 'renamed' }));
      service.updated(dir({ id: 'd2', name: 'child' }));

      expect(query.getEntity('d1').name).toBe('renamed');
      expect(query.ui.getEntity('d1').isExpanded).toBe(true);
      expect(query.ui.getEntity('d2')).toEqual({
        id: 'd2',
        ...initialDirectoryUIState,
      });

      service.deleted('d1');

      expect(query.getAll().map((d) => d.id)).toEqual(['d2']);
      expect(query.ui.hasEntity('d1')).toBe(false);
    });
  });

  describe('expansion toggles', () => {
    const toggles: {
      method: string;
      flag: keyof Omit<DirectoryUI, 'id'>;
      toggle: (service: DirectoryService, ui: DirectoryUI) => void;
    }[] = [
      {
        method: 'toggleIsExpanded',
        flag: 'isExpanded',
        toggle: (s, ui) => s.toggleIsExpanded(ui),
      },
      {
        method: 'toggleIsFilesExpanded',
        flag: 'isFilesExpanded',
        toggle: (s, ui) => s.toggleIsFilesExpanded(ui),
      },
      {
        method: 'toggleIsWorkspacesExpanded',
        flag: 'isWorkspacesExpanded',
        toggle: (s, ui) => s.toggleIsWorkspacesExpanded(ui),
      },
      {
        method: 'toggleIsDirectoriesExpanded',
        flag: 'isDirectoriesExpanded',
        toggle: (s, ui) => s.toggleIsDirectoriesExpanded(ui),
      },
      {
        method: 'toggleIsDesignsExpanded',
        flag: 'isDesignsExpanded',
        toggle: (s, ui) => s.toggleIsDesignsExpanded(ui),
      },
    ];

    /**
     * Verifies: each toggle flips only its own flag on the directory's UI
     *   entity.
     * Interacts with: DirectoryStore.ui.upsert; isUpdate.
     * Data: stored d1 (all collapsed); toggled twice.
     */
    it.each(toggles)('$method flips $flag', ({ flag, toggle }) => {
      const { service, query } = setup({}, [dir()]);
      const ui = () => query.ui.getEntity('d1');

      toggle(service, ui());
      expect(ui()).toEqual({
        id: 'd1',
        ...initialDirectoryUIState,
        [flag]: true,
      });

      toggle(service, ui());
      expect(ui()[flag]).toBe(false);
    });

    /**
     * Verifies: toggling a directory without UI state creates a UI entity
     *   whose flag is undefined rather than true.
     * Interacts with: DirectoryStore.ui.upsert (create branch); isUpdate({}).
     * Data: empty store; toggleIsExpanded({ id: 'd9' }).
     */
    it('creates an undefined flag for a directory without UI state', () => {
      const { service, query } = setup();

      service.toggleIsExpanded({ id: 'd9' } as DirectoryUI);

      // NOTE: the directory panel only toggles directories it has rendered,
      // which always have UI state.
      expect(query.ui.getEntity('d9')).toEqual({
        id: 'd9',
        isExpanded: undefined,
      });
    });
  });

  describe('export and import', () => {
    /**
     * Verifies: export requests the archive with the given type and id flag
     *   as a full response, and returns the blob and file name.
     * Interacts with: DirectoriesService.exportDirectory (stub, 'response'
     *   overload); HttpHeaderUtils.getFilename.
     * Data: export d1 as tgz with ids; the API answers 'root.tgz'.
     */
    it('export() returns the archive and its file name', async () => {
      const response = downloadResponse('root.tgz');
      const directoriesApi = {
        exportDirectory: vi.fn(
          (
            _id: string,
            _type?: ArchiveType,
            _ids?: boolean,
            _observe?: 'response',
          ) => of(response),
        ),
      } satisfies ApiStub<DirectoriesService>;
      const { service } = setup(directoriesApi);

      const download = await firstValueFrom(
        service.export('d1', ArchiveType.Tgz, true),
      );

      expect(directoriesApi.exportDirectory).toHaveBeenCalledWith(
        'd1',
        'tgz',
        true,
        'response',
      );
      expect(download).toEqual({ blob: response.body, filename: 'root.tgz' });
    });

    /**
     * Verifies: import forwards the archive to the API and returns its
     *   result without touching the store.
     * Interacts with: DirectoriesService.importDirectory (stub).
     * Data: stored d1; a Blob archive, preserveIds false.
     */
    it('import() forwards the archive', async () => {
      const result: ImportDirectoryResult = { lockedFiles: [] };
      const directoriesApi = {
        importDirectory: vi.fn(() => of(result)),
      } satisfies ApiStub<DirectoriesService>;
      const { service, query } = setup(directoriesApi, [dir()]);
      const archive = new Blob(['zip']);

      expect(await firstValueFrom(service.import('d1', false, archive))).toBe(
        result,
      );
      expect(directoriesApi.importDirectory).toHaveBeenCalledWith(
        'd1',
        false,
        archive,
      );
      expect(query.getAll()).toEqual([dir()]);
    });
  });
});
