// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { FilesService, ModelFile } from '../../generated/caster-api';
import { ApiStub, endpointStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { downloadResponse } from '../../test-utils/download-response';
import { recordEmissions } from '../../test-utils/record-emissions';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../test-utils/unhandled-rx-errors';
import { FileQuery } from './file.query';
import { FileService } from './file.service';
import { FileStore, initialFileUIState } from './file.store';

function file(overrides: Partial<ModelFile> = {}): ModelFile {
  return {
    id: 'f1',
    name: 'main.tf',
    directoryId: 'd1',
    workspaceId: null,
    content: 'server content',
    lockedById: null,
    isDeleted: false,
    ...overrides,
  };
}

/**
 * Real FileStore, FileQuery and FileService; only FilesService is stubbed.
 * Any other generated API stays an `unstubbed()` placeholder.
 */
function setup(filesApi: ApiStub<FilesService> = {}, files: ModelFile[] = []) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: FilesService, useValue: filesApi },
    ]),
  });
  const store = TestBed.inject(FileStore);
  const query = TestBed.inject(FileQuery);
  const service = TestBed.inject(FileService);
  store.add(files);
  return { service, store, query };
}

const boom = () => throwError(() => new Error('boom'));

describe('FileService', () => {
  describe('loadFile', () => {
    /**
     * Verifies: loading a file stores it with editorContent copied from the
     *   server content, marks it saved, and emits the file.
     * Interacts with: FilesService.getFile (stub); FileStore.upsert; setSave.
     * Data: empty store; the API returns f1.
     */
    it('stores the file with its editor content and marks it saved', async () => {
      const filesApi = {
        getFile: vi.fn(() => of(file())),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi);

      const loaded = await firstValueFrom(service.loadFile('f1'));

      expect(filesApi.getFile).toHaveBeenCalledWith('f1');
      expect(loaded.editorContent).toBe('server content');
      expect(query.getEntity('f1')).toEqual({
        ...file(),
        editorContent: 'server content',
      });
      expect(query.ui.getEntity('f1').isSaved).toBe(true);
    });

    /**
     * Verifies: reloading a file with unsaved edits replaces the editor
     *   buffer with the server content and marks it saved again.
     * Interacts with: FilesService.getFile (stub); updateEditorContent.
     * Data: stored f1 edited locally to 'draft'; the API returns 'v2'.
     */
    it('discards unsaved editor content on reload', async () => {
      const filesApi = {
        getFile: vi.fn(() => of(file({ content: 'v2' }))),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi, [file()]);
      service.updateEditorContent('f1', 'draft');

      await firstValueFrom(service.loadFile('f1'));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'v2',
        editorContent: 'v2',
      });
      expect(query.isSaved('f1')).toBe(true);
    });

    /**
     * Verifies: a failed load leaves the store untouched and passes the
     *   error to the subscriber.
     * Interacts with: FilesService.getFile (throwError stub).
     * Data: empty store; the API errors with 'boom'.
     */
    it('leaves the store untouched when the load fails', async () => {
      const { service, query } = setup({ getFile: vi.fn(boom) });

      const error = await firstValueFrom(service.loadFile('f1')).catch(
        (e: unknown) => e,
      );

      expect(error).toEqual(new Error('boom'));
      expect(query.getCount()).toBe(0);
    });
  });

  describe('loadFilesByDirectory', () => {
    /**
     * Verifies: asks for the directory's files without content, upserts them
     *   as saved, and keeps the editor buffer of a file that is already
     *   loaded; a new file gets no editor content.
     * Interacts with: FilesService.getFilesByDirectory (stub); upsertFile.
     * Data: stored f1 with editorContent 'draft'; the API returns f1
     *   (renamed) and new f2.
     */
    it('upserts the directory files and keeps loaded editor buffers', async () => {
      const filesApi = {
        getFilesByDirectory: vi.fn(() =>
          of([
            file({ name: 'renamed.tf' }),
            file({ id: 'f2', name: 'vars.tf', content: 'vars' }),
          ]),
        ),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi, [file()]);
      service.updateEditorContent('f1', 'draft');

      await firstValueFrom(service.loadFilesByDirectory('d1'));

      expect(filesApi.getFilesByDirectory).toHaveBeenCalledWith('d1', false);
      expect(query.getEntity('f1')).toMatchObject({
        name: 'renamed.tf',
        editorContent: 'draft',
      });
      expect(query.getEntity('f2')).toEqual({
        ...file({ id: 'f2', name: 'vars.tf', content: 'vars' }),
        editorContent: undefined,
      });
      expect(query.isSaved('f1')).toBe(true);
      expect(query.isSaved('f2')).toBe(true);
    });
  });

  describe('setFiles', () => {
    /**
     * Verifies: setFiles replaces every stored file.
     * Interacts with: FileStore.set.
     * Data: stored f1; set to [f2].
     */
    it('replaces the stored files', () => {
      const { service, query } = setup({}, [file()]);

      service.setFiles([file({ id: 'f2' })]);

      expect(query.getAll().map((f) => f.id)).toEqual(['f2']);
    });
  });

  describe('add', () => {
    /**
     * Verifies: creates the file through the API and adds the response with
     *   editorContent copied from content and default UI state.
     * Interacts with: FilesService.createFile (stub).
     * Data: new file 'new.tf'; the API returns f9.
     */
    it('creates the file and stores the response', () => {
      const created = file({ id: 'f9', name: 'new.tf', content: '' });
      const filesApi = {
        createFile: vi.fn(() => of(created)),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi);
      const input = file({ id: undefined, name: 'new.tf' });

      service.add(input);

      expect(filesApi.createFile).toHaveBeenCalledWith(input);
      expect(query.getEntity('f9')).toEqual({ ...created, editorContent: '' });
      expect(query.ui.getEntity('f9')).toEqual({
        id: 'f9',
        ...initialFileUIState,
      });
    });

    /**
     * Verifies: a failed create adds nothing, and the error is not handled
     *   by the service.
     * Interacts with: FilesService.createFile (throwError stub); rxjs
     *   config.onUnhandledError.
     * Data: empty store; the API errors with 'boom'.
     */
    it('adds nothing and does not handle a create error', async () => {
      const errors = captureUnhandledRxErrors();
      const { service, query } = setup({ createFile: vi.fn(boom) });

      service.add(file());
      await flush();

      expect(query.getCount()).toBe(0);
      expect(errors).toEqual([new Error('boom')]);
    });
  });

  describe('edits', () => {
    /**
     * Verifies: updateFile sends the whole file to editFile and stores the
     *   response as saved.
     * Interacts with: FilesService.editFile (stub); fileUpdated.
     * Data: stored f1; edit with a new name.
     */
    it('updateFile() edits the file and stores the response', () => {
      const edited = file({ name: 'edited.tf' });
      const filesApi = {
        editFile: vi.fn(() => of(edited)),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi, [file()]);

      service.updateFile(edited);

      expect(filesApi.editFile).toHaveBeenCalledWith('f1', edited);
      expect(query.getEntity('f1').name).toBe('edited.tf');
      expect(query.isSaved('f1')).toBe(true);
    });

    /**
     * Verifies: updateFileContent sends only the content, on subscribe, and
     *   marks the file saved when the API answers; the editor buffer is kept.
     * Interacts with: FilesService.partialEditFile (Subject stub).
     * Data: stored f1 with unsaved editor content 'draft'.
     */
    it('updateFileContent() saves the content and marks the file saved', () => {
      const response$ = new Subject<ModelFile>();
      const filesApi = {
        partialEditFile: vi.fn(() => response$),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi, [file()]);
      service.updateEditorContent('f1', 'draft');

      const seen = recordEmissions(service.updateFileContent('f1', 'draft'));

      expect(filesApi.partialEditFile).toHaveBeenCalledWith('f1', {
        content: 'draft',
      });
      expect(query.isSaved('f1')).toBe(false);

      response$.next(file({ content: 'draft' }));

      expect(seen).toHaveLength(1);
      expect(query.getEntity('f1')).toMatchObject({
        content: 'draft',
        editorContent: 'draft',
      });
      expect(query.isSaved('f1')).toBe(true);
    });

    /**
     * Verifies: renameFile sends the new name and copies only the name from
     *   the response, keeping the stored content and editor buffer.
     * Interacts with: FilesService.renameFile (stub).
     * Data: stored f1 with editor content 'draft'; the API returns the file
     *   renamed and with different content.
     */
    it('renameFile() only takes the name from the response', () => {
      const filesApi = {
        renameFile: vi.fn(() =>
          of(file({ name: 'renamed.tf', content: 'other' })),
        ),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi, [
        file({ editorContent: 'draft' }),
      ]);

      service.renameFile('f1', 'renamed.tf');

      expect(filesApi.renameFile).toHaveBeenCalledWith('f1', {
        name: 'renamed.tf',
      });
      expect(query.getEntity('f1')).toEqual(
        file({ name: 'renamed.tf', editorContent: 'draft' }),
      );
    });
  });

  describe('locking', () => {
    const rows: {
      method: string;
      endpoint:
        | 'lockFile'
        | 'unlockFile'
        | 'administrativelyLockFile'
        | 'administrativelyUnlockFile'
        | 'forceUnlockFile';
      call: (service: FileService) => void;
      lockedById: string | null;
    }[] = [
      {
        method: 'lockFile',
        endpoint: 'lockFile',
        call: (s) => s.lockFile('f1'),
        lockedById: 'u1',
      },
      {
        method: 'unlockFile',
        endpoint: 'unlockFile',
        call: (s) => s.unlockFile('f1'),
        lockedById: null,
      },
      {
        method: 'adminLockFile',
        endpoint: 'administrativelyLockFile',
        call: (s) => s.adminLockFile('f1'),
        lockedById: null,
      },
      {
        method: 'adminUnlockFile',
        endpoint: 'administrativelyUnlockFile',
        call: (s) => s.adminUnlockFile('f1'),
        lockedById: null,
      },
      {
        method: 'forceUnlockFile',
        endpoint: 'forceUnlockFile',
        call: (s) => s.forceUnlockFile('f1'),
        lockedById: null,
      },
    ];

    /**
     * Verifies: each lock action calls its own endpoint with the file id and
     *   stores the returned file.
     * Interacts with: the named FilesService endpoint (stub); fileUpdated.
     * Data: stored f1; the API returns f1 with the row's lockedById.
     */
    it.each(rows)(
      '$method calls $endpoint and stores the result',
      ({ endpoint, call, lockedById }) => {
        const endpointFn = vi.fn(() => of(file({ lockedById })));
        const { service, query } = setup(
          endpointStub(FilesService, endpoint, endpointFn),
          [file({ lockedById: 'someone' })],
        );

        call(service);

        expect(endpointFn).toHaveBeenCalledWith('f1');
        expect(query.getEntity('f1').lockedById).toBe(lockedById);
      },
    );
  });

  describe('fileUpdated (FileCreated / FileUpdated hub events)', () => {
    /**
     * Verifies: an unknown file is added with the payload's fields, no editor
     *   content, default UI state and isSaved true.
     * Interacts with: upsertFile (create branch); setSave.
     * Data: empty store; event for f1.
     */
    it('adds an unknown file', () => {
      const { service, query } = setup();

      service.fileUpdated(file());

      expect(query.getEntity('f1')).toEqual({
        ...file(),
        editorContent: undefined,
      });
      expect(query.ui.getEntity('f1')).toEqual({
        id: 'f1',
        ...initialFileUIState,
      });
    });

    /**
     * Verifies: while the lock holder is unchanged, a server update keeps the
     *   local editor buffer.
     * Interacts with: fileUpdated lock comparison; upsertFile (update branch).
     * Data: stored f1 locked by u1 with editor content 'draft'; event with new
     *   content, still locked by u1.
     */
    it('keeps the editor buffer while the same user holds the lock', () => {
      const { service, query } = setup({}, [
        file({ lockedById: 'u1', editorContent: 'draft' }),
      ]);

      service.fileUpdated(file({ lockedById: 'u1', content: 'saved v2' }));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'saved v2',
        editorContent: 'draft',
      });
    });

    /**
     * Verifies: when another user's lock is released or changes hands, the
     *   editor buffer is reset to the server content.
     * Interacts with: fileUpdated lock comparison.
     * Data: stored f1 locked by u2 with stale editor content; event unlocked
     *   with new content.
     */
    it('resets the editor buffer when the previous lock is released', () => {
      const { service, query } = setup({}, [
        file({ lockedById: 'u2', editorContent: 'stale' }),
      ]);

      service.fileUpdated(file({ lockedById: null, content: 'saved by u2' }));

      expect(query.getEntity('f1')).toMatchObject({
        lockedById: null,
        content: 'saved by u2',
        editorContent: 'saved by u2',
      });
    });

    /**
     * Verifies: a file that was not locked keeps its editor buffer when
     *   someone else locks it and saves new content.
     * Interacts with: fileUpdated lock comparison (no previous lock).
     * Data: stored f1 unlocked with editor content 'mine'; event locked by u2
     *   with new content.
     */
    it('keeps the editor buffer when an unlocked file gets locked', () => {
      const { service, query } = setup({}, [file({ editorContent: 'mine' })]);

      service.fileUpdated(file({ lockedById: 'u2', content: 'theirs' }));

      // NOTE: the buffer only resyncs once u2's lock is released (previous test).
      expect(query.getEntity('f1')).toMatchObject({
        lockedById: 'u2',
        content: 'theirs',
        editorContent: 'mine',
      });
    });

    /**
     * Verifies: filesUpdated upserts every file and marks each saved.
     * Interacts with: upsertFile; setSave.
     * Data: stored f1 marked unsaved; event list [f1, f2].
     */
    it('filesUpdated() upserts a batch and marks each saved', () => {
      const { service, query } = setup({}, [file()]);
      service.setSave('f1', false);

      service.filesUpdated([file({ name: 'a.tf' }), file({ id: 'f2' })]);

      expect(query.getEntity('f1').name).toBe('a.tf');
      expect(query.hasEntity('f2')).toBe(true);
      expect(query.isSaved('f1')).toBe(true);
      expect(query.isSaved('f2')).toBe(true);
    });
  });

  describe('updateEditorContent', () => {
    /**
     * Verifies: typing in the editor stores the buffer, leaves the saved
     *   content alone and marks the file unsaved.
     * Interacts with: FileStore.update; setSave.
     * Data: stored f1.
     */
    it('stores the buffer and marks the file unsaved', () => {
      const { service, query } = setup({}, [file()]);
      const saved = recordEmissions(query.selectIsSaved('f1'));

      service.updateEditorContent('f1', 'typing');

      expect(query.getEntity('f1')).toMatchObject({
        content: 'server content',
        editorContent: 'typing',
      });
      expect(saved).toEqual([true, false]);
    });
  });

  describe('delete and fileDeleted', () => {
    /**
     * Verifies: delete removes the file and its UI state only after the API
     *   succeeds.
     * Interacts with: FilesService.deleteFile (Subject stub); fileDeleted.
     * Data: stored f1 and f2; delete f1.
     */
    it('delete() removes the file after the API succeeds', () => {
      const response$ = new Subject<void>();
      const filesApi = {
        deleteFile: vi.fn(() => response$),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi, [file(), file({ id: 'f2' })]);

      service.delete(file());
      expect(filesApi.deleteFile).toHaveBeenCalledWith('f1');
      expect(query.hasEntity('f1')).toBe(true);

      response$.next();

      expect(query.getAll().map((f) => f.id)).toEqual(['f2']);
      expect(query.ui.hasEntity('f1')).toBe(false);
    });

    /**
     * Verifies: a failed delete keeps the file, and the error is not handled
     *   by the service.
     * Interacts with: FilesService.deleteFile (throwError stub).
     * Data: stored f1; the API errors with 'boom'.
     */
    it('delete() keeps the file when the API fails', async () => {
      const errors = captureUnhandledRxErrors();
      const { service, query } = setup({ deleteFile: vi.fn(boom) }, [file()]);

      service.delete(file());
      await flush();

      expect(query.hasEntity('f1')).toBe(true);
      expect(errors).toEqual([new Error('boom')]);
    });
  });

  describe('UI state', () => {
    /**
     * Verifies: setActive marks a file active, and null clears it.
     * Interacts with: FileStore.setActive; FileQuery.getActiveId.
     * Data: stored f1.
     */
    it('sets and clears the active file', () => {
      const { service, query } = setup({}, [file()]);

      service.setActive(file());
      expect(query.getActiveId()).toBe('f1');

      service.setActive(null);
      expect(query.getActiveId()).toBeNull();
    });

    /**
     * Verifies: setSelectedVersionId stores the version on a known file's UI
     *   state, and creates a bare UI entity (no isSaved) for an unknown one.
     * Interacts with: FileStore.ui.upsert; FileQuery.getSelectedVersionId.
     * Data: stored f1; versions for f1 and for unknown f9.
     */
    it('sets the selected version', () => {
      const { service, query } = setup({}, [file()]);

      service.setSelectedVersionId('f1', 'v3');
      service.setSelectedVersionId('f9', 'v1');

      expect(query.ui.getEntity('f1')).toEqual({
        id: 'f1',
        isSaved: true,
        selectedVersionId: 'v3',
      });
      expect(query.ui.getEntity('f9')).toEqual({
        id: 'f9',
        selectedVersionId: 'v1',
      });
    });
  });

  describe('export', () => {
    /**
     * Verifies: export asks for the full HTTP response and returns the body
     *   with the file name from Content-Disposition.
     * Interacts with: FilesService.exportFile (stub, 'response' overload);
     *   HttpHeaderUtils.getFilename.
     * Data: the API responds with a Blob named main.tf.
     */
    it('returns the blob and the download file name', async () => {
      const response = downloadResponse('main.tf');
      const filesApi = {
        exportFile: vi.fn((_id: string, _observe?: 'response') => of(response)),
      } satisfies ApiStub<FilesService>;
      const { service } = setup(filesApi);

      const download = await firstValueFrom(service.export('f1'));

      expect(filesApi.exportFile).toHaveBeenCalledWith('f1', 'response');
      expect(download).toEqual({ blob: response.body, filename: 'main.tf' });
    });
  });
});
