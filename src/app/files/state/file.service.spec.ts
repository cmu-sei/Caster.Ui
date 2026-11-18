// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import {
  EditFileCommand,
  FilesService,
  ModelFile,
} from '../../generated/caster-api';
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
     * Verifies: updateFile sends editFile only the file's name and content
     *   (not its directory, workspace or lock fields) and stores the response
     *   as saved.
     * Interacts with: FilesService.editFile (stub); fileUpdated.
     * Data: stored f1; edit with a new name and content, in directory d1 and
     *   workspace w1.
     */
    it('updateFile() edits the file and stores the response', () => {
      const edited = file({
        name: 'edited.tf',
        content: 'edited content',
        workspaceId: 'w1',
      });
      const filesApi = {
        editFile: vi.fn((_id: string, _command?: EditFileCommand) =>
          of(edited),
        ),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup(filesApi, [file()]);

      service.updateFile(edited);

      expect(filesApi.editFile).toHaveBeenCalledTimes(1);
      expect(filesApi.editFile.mock.calls[0]).toStrictEqual([
        'f1',
        { name: 'edited.tf', content: 'edited content' },
      ]);
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

  /**
   * A file's saved content reaches the store from the server's events, the answer to a save and a file read again, in
   * any order. Each case is an order a review found, run through the real store.
   */
  describe('changes made elsewhere, in any order', () => {
    const T1 = '2026-11-18T10:00:00Z';
    const T2 = '2026-11-18T10:00:05Z';
    const T3 = '2026-11-18T10:00:09Z';

    /**
     * Verifies: a tab with no unsaved edits follows content saved elsewhere, such as by AI, and stays saved.
     * Data: stored f1 clean on 'old'; an event brings 'ai' saved later.
     */
    it('moves a clean tab to the new content', () => {
      const { service, query } = setup({}, [
        file({ content: 'old', editorContent: 'old', dateSaved: T1 }),
      ]);

      service.fileUpdated(file({ content: 'ai', dateSaved: T2 }));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'ai',
        editorContent: 'ai',
      });
      expect(query.ui.getEntity('f1').isSaved).toBe(true);
    });

    /**
     * Verifies: a tab with unsaved edits keeps them, and stays unsaved, when content is saved elsewhere.
     * Data: near miss of the test above: buffer 'mine' over 'old'.
     */
    it('keeps the edits in a tab that has them', () => {
      const { service, query } = setup({}, [
        file({ content: 'old', editorContent: 'mine', dateSaved: T1 }),
      ]);

      service.fileUpdated(file({ content: 'ai', dateSaved: T2 }));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'ai',
        editorContent: 'mine',
      });
      expect(query.ui.getEntity('f1').isSaved).toBe(false);
    });

    /**
     * Verifies: the file's own event arriving before the answer to the save leaves a clean tab on the new content, saved.
     * Data: stored f1 clean on 'old'; the event, then the answer, both 'ai' saved at T2.
     */
    it('shows the new content when the event comes before the answer', () => {
      const { service, query } = setup({}, [
        file({ content: 'old', editorContent: 'old', dateSaved: T1 }),
      ]);

      service.fileUpdated(file({ content: 'ai', dateSaved: T2 }));
      service.fileUpdated(file({ content: 'ai', dateSaved: T2 }));

      expect(query.getEntity('f1').editorContent).toBe('ai');
      expect(query.ui.getEntity('f1').isSaved).toBe(true);
    });

    /**
     * Verifies: a read that answers after a newer save is dropped, so it cannot put back the older content.
     * Interacts with: refreshFile; FilesService.getFile answered late.
     * Data: the AI saved 'ai' at T2 and the read starts; the planner saves 'B' at T3; then the read answers 'ai' at T2.
     */
    it('drops a read older than a save made meanwhile', () => {
      const answer = new Subject<ModelFile>();
      const { service, query } = setup({ getFile: vi.fn(() => answer) }, [
        file({ content: 'ai', editorContent: 'ai', dateSaved: T2 }),
      ]);
      service.refreshFile('f1').subscribe();

      service.updateEditorContent('f1', 'B');
      service.fileUpdated(file({ content: 'B', dateSaved: T3 }));
      answer.next(file({ content: 'ai', dateSaved: T2 }));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'B',
        editorContent: 'B',
      });
      expect(query.ui.getEntity('f1').isSaved).toBe(true);
    });

    /**
     * Verifies: the older read is dropped although the planner typed again after saving, and the new typing is kept.
     * Data: near miss of the test above: after saving 'B' the planner types 'C' before the read answers.
     */
    it('drops an older read and keeps typing made after a save', () => {
      const answer = new Subject<ModelFile>();
      const { service, query } = setup({ getFile: vi.fn(() => answer) }, [
        file({ content: 'ai', editorContent: 'ai', dateSaved: T2 }),
      ]);
      service.refreshFile('f1').subscribe();

      service.updateEditorContent('f1', 'B');
      service.fileUpdated(file({ content: 'B', dateSaved: T3 }));
      service.updateEditorContent('f1', 'C');
      answer.next(file({ content: 'ai', dateSaved: T2 }));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'B',
        editorContent: 'C',
      });
      expect(query.ui.getEntity('f1').isSaved).toBe(false);
    });

    /**
     * Verifies: typing while a change is applied, or while the file is read again, is kept, whenever it started.
     * Data: stored f1 clean on 'old'; the planner types 'typed', then the read answers 'ai' saved later.
     */
    it('keeps typing made while the change was applied or read', () => {
      const answer = new Subject<ModelFile>();
      const { service, query } = setup({ getFile: vi.fn(() => answer) }, [
        file({ content: 'old', editorContent: 'old', dateSaved: T1 }),
      ]);
      service.refreshFile('f1').subscribe();

      service.updateEditorContent('f1', 'typed');
      answer.next(file({ content: 'ai', dateSaved: T2 }));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'ai',
        editorContent: 'typed',
      });
      expect(query.ui.getEntity('f1').isSaved).toBe(false);
    });

    /**
     * Verifies: a file not opened yet gets the new content in its buffer too, so its tab opens on it, not blank.
     * Data: stored f1 listed without content or buffer; an added file read for the first time.
     */
    it('stores the content of a file that is not open', async () => {
      const { service, query } = setup(
        { getFile: vi.fn(() => of(file({ content: 'ai', dateSaved: T2 }))) },
        [file({ content: null, editorContent: undefined, dateSaved: T1 })],
      );

      await firstValueFrom(service.refreshFile('f1'));

      expect(query.getEntity('f1').content).toBe('ai');
      // the tab opens on this content, since a file with content is not loaded again
      expect(query.getEntity('f1').editorContent).toBe('ai');
      expect(query.ui.getEntity('f1').isSaved).toBe(true);
    });

    /**
     * Verifies: a rename between a save and its delayed answer does not make the save look older and drop it.
     * Data: stored f1 clean on 'A' at T1; a rename event (no content) stamped T3, then the AI's 'B' at T2.
     */
    it('takes content saved before a rename that arrives after it', () => {
      const { service, query } = setup({}, [
        file({ content: 'A', editorContent: 'A', dateSaved: T1 }),
      ]);

      service.fileUpdated(
        file({ name: 'renamed.tf', content: null, dateSaved: T3 }),
      );
      service.fileUpdated(file({ content: 'B', dateSaved: T2 }));

      expect(query.getEntity('f1')).toMatchObject({
        name: 'renamed.tf',
        content: 'B',
        editorContent: 'B',
      });
    });

    /**
     * Verifies: a read that answers late with an older lock state neither unlocks the file in the store nor discards edits.
     * Interacts with: refreshFile; FilesService.getFile answered late.
     * Data: the read starts while f1 is unlocked; the planner locks it (u1) and types 'C'; the read answers unlocked.
     */
    it('keeps the lock and edits when a late read shows an older lock', () => {
      const answer = new Subject<ModelFile>();
      const { service, query } = setup({ getFile: vi.fn(() => answer) }, [
        file({ content: 'A', editorContent: 'A', dateSaved: T1 }),
      ]);
      service.refreshFile('f1').subscribe();

      service.fileUpdated(
        file({ content: null, lockedById: 'u1', dateSaved: T1 }),
      );
      service.updateEditorContent('f1', 'C');
      answer.next(file({ content: 'B', lockedById: null, dateSaved: T2 }));

      expect(query.getEntity('f1')).toMatchObject({
        lockedById: 'u1',
        content: 'B',
        editorContent: 'C',
      });
      expect(query.ui.getEntity('f1').isSaved).toBe(false);
    });

    /**
     * Verifies: opening a tab loads the file at its save time, so an older answer after that is dropped.
     * Interacts with: loadFile; fileUpdated.
     * Data: 'A' at T1, a rename at T3, the tab loads 'C' at T3, then the AI's older 'B' at T2 arrives.
     */
    it('drops content older than what a tab loaded', async () => {
      const { service, query } = setup(
        { getFile: vi.fn(() => of(file({ content: 'C', dateSaved: T3 }))) },
        [file({ content: 'A', editorContent: 'A', dateSaved: T1 })],
      );
      service.fileUpdated(file({ content: null, dateSaved: T3 }));
      await firstValueFrom(service.loadFile('f1'));

      service.fileUpdated(file({ content: 'B', dateSaved: T2 }));

      expect(query.getEntity('f1').content).toBe('C');
    });

    /**
     * Verifies: a read that answers after the file was deleted does not bring it back.
     * Interacts with: refreshFile; FilesService.getFile answered late; fileDeleted.
     * Data: the read of f1 starts; the file is deleted; the read answers.
     */
    it('does not bring back a file deleted while it was read', () => {
      const answer = new Subject<ModelFile>();
      const { service, query } = setup({ getFile: vi.fn(() => answer) }, [
        file({ content: 'A', editorContent: 'A', dateSaved: T1 }),
      ]);
      service.refreshFile('f1').subscribe();

      service.fileDeleted('f1');
      answer.next(file({ content: 'B', dateSaved: T2 }));

      expect(query.getEntity('f1')).toBeUndefined();
    });

    /**
     * Verifies: a deleted file that the server sends again, as when it is restored, is shown again.
     * Data: near miss of the test above: after the delete, a FileUpdated event brings f1.
     */
    it('shows a deleted file again when the server sends it', () => {
      const { service, query } = setup({}, [
        file({ content: 'A', editorContent: 'A', dateSaved: T1 }),
      ]);
      service.fileDeleted('f1');

      service.fileUpdated(file({ content: 'B', dateSaved: T2 }));

      expect(query.getEntity('f1').content).toBe('B');
    });

    /**
     * Verifies: save times are ordered past the millisecond, as the server sends them.
     * Data: stored 'B' at .1239 of a second; an older 'A' at .1231 of the same second.
     */
    it('orders save times that differ below a millisecond', () => {
      const { service, query } = setup({}, [
        file({
          content: 'B',
          editorContent: 'B',
          dateSaved: '2026-11-18T10:00:05.1239Z',
        }),
      ]);

      service.fileUpdated(
        file({ content: 'A', dateSaved: '2026-11-18T10:00:05.1231Z' }),
      );

      expect(query.getEntity('f1').content).toBe('B');
    });
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

      // the buffer starts as the content, so the file's tab opens on it rather than blank
      expect(query.getEntity('f1')).toEqual({
        ...file(),
        editorContent: file().content,
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
     * Verifies: an update without content (lock, unlock, rename) keeps the
     *   loaded content, so the open tab does not reload the file over the
     *   user's unsaved edits.
     * Interacts with: fileUpdated null-content guard; upsertFile (update branch).
     * Data: stored f1 locked by u1 with editor content 'draft'; event still
     *   locked by u1 with content null, as the hub sends for a lock change.
     */
    it('keeps the loaded content when the update carries none', () => {
      const { service, query } = setup({}, [
        file({ lockedById: 'u1', editorContent: 'draft' }),
      ]);

      service.fileUpdated(file({ lockedById: 'u1', content: null }));

      expect(query.getEntity('f1')).toMatchObject({
        content: 'server content',
        editorContent: 'draft',
      });
    });

    /**
     * Verifies: when another user's lock is released with no content in the
     *   event, the editor buffer resets to the loaded content, not to null.
     * Interacts with: fileUpdated null-content guard, then the lock comparison.
     * Data: stored f1 locked by u2 with stale editor content; unlock event with
     *   content null.
     */
    it('resets the editor buffer to the loaded content on a contentless unlock', () => {
      const { service, query } = setup({}, [
        file({ lockedById: 'u2', editorContent: 'stale' }),
      ]);

      service.fileUpdated(file({ lockedById: null, content: null }));

      expect(query.getEntity('f1')).toMatchObject({
        lockedById: null,
        content: 'server content',
        editorContent: 'server content',
      });
    });

    /**
     * Verifies: a file whose content was never loaded stays without content,
     *   so opening its tab still loads it.
     * Interacts with: fileUpdated null-content guard (no loaded content).
     * Data: stored f1 listed without content; near miss of the test above:
     *   event with content null.
     */
    it('leaves content unloaded when none was loaded', () => {
      const { service, query } = setup({}, [file({ content: null })]);

      service.fileUpdated(file({ lockedById: 'u1', content: null }));

      expect(query.getEntity('f1').content).toBeNull();
    });

    /**
     * Verifies: an update that leaves the user's edits in the buffer keeps the
     *   file unsaved, so Save stays enabled.
     * Interacts with: fileUpdated setSave from isFileContentChanged.
     * Data: stored f1 locked by u1 with editor content 'draft', marked
     *   unsaved; rename event still locked by u1 with content null.
     */
    it('keeps a file with unsaved edits unsaved', () => {
      const { service, query } = setup({}, [
        file({ lockedById: 'u1', editorContent: 'draft' }),
      ]);
      service.setSave('f1', false);

      service.fileUpdated(
        file({ name: 'renamed.tf', lockedById: 'u1', content: null }),
      );

      expect(query.ui.getEntity('f1').isSaved).toBe(false);
    });

    /**
     * Verifies: an update whose content matches the editor buffer (the save
     *   response) marks the file saved.
     * Interacts with: fileUpdated setSave from isFileContentChanged.
     * Data: near miss of the test above: stored f1 with editor content
     *   'saved v2', marked unsaved; event with content 'saved v2'.
     */
    it('marks the file saved when the update matches the buffer', () => {
      const { service, query } = setup({}, [
        file({ lockedById: 'u1', editorContent: 'saved v2' }),
      ]);
      service.setSave('f1', false);

      service.fileUpdated(file({ lockedById: 'u1', content: 'saved v2' }));

      expect(query.ui.getEntity('f1').isSaved).toBe(true);
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
