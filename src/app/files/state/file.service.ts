// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { FileDownload } from 'src/app/shared/models/file-download';
import HttpHeaderUtils from 'src/app/shared/utilities/http-header-utils';
import { FilesService, ModelFile } from '../../generated/caster-api';
import { isFileContentChanged } from './file-content';
import { FileQuery } from './file.query';
import { FileStore } from './file.store';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  private fileStore = inject(FileStore);
  private fileQuery = inject(FileQuery);
  // when the content held for each file was saved, apart from its other details
  private contentSavedAt = new Map<string, string>();
  // files deleted while this page was open, so an answer that arrives after the delete cannot bring one back
  private deleted = new Set<string>();
  private filesService = inject(FilesService);

  loadFile(fileId: string): Observable<ModelFile> {
    return this.filesService.getFile(fileId).pipe(
      tap((file) => {
        file.editorContent = file.content;
        // the content held is now this file's, at its save time
        this.contentSavedAt.delete(fileId);
        this.fileStore.upsert(file.id, file);
        this.setSave(fileId, true);
      }),
    );
  }

  /** Reads a file again after something else saved it; the store decides what an open tab shows (see fileUpdated). */
  refreshFile(fileId: string): Observable<ModelFile> {
    return (this.filesService.getFile(fileId) as Observable<ModelFile>).pipe(
      tap((file: ModelFile) => {
        const prev = this.fileQuery.getEntity(fileId);
        // only the content is taken: a lock or unlock does not change the save time, so the lock in a read that answers
        // late cannot be told from a newer one, and the events and lock answers keep the lock
        this.fileUpdated(
          prev
            ? { ...prev, content: file.content, dateSaved: file.dateSaved }
            : file,
        );
      }),
    );
  }

  loadFilesByDirectory(directoryId: string): Observable<ModelFile[]> {
    return this.filesService.getFilesByDirectory(directoryId, false).pipe(
      tap((files) => {
        files.forEach((file) => {
          this.upsertFile(file);
          this.setSave(file.id, true);
        });
      }),
    );
  }

  setFiles(files: ModelFile[]) {
    this.contentSavedAt.clear();
    this.fileStore.set(files);
  }

  add(file: ModelFile) {
    this.filesService.createFile(file).subscribe((f) => {
      f.editorContent = f.content;
      this.fileStore.add(f);
    });
  }

  updateFile(file: ModelFile) {
    const command = { name: file.name, content: file.content };
    this.filesService.editFile(file.id, command).subscribe((f) => {
      this.fileUpdated(f);
    });
  }

  updateFileContent(fileId: string, fileContent: string): Observable<any> {
    return this.filesService
      .partialEditFile(fileId, { content: fileContent })
      .pipe(
        tap((f) => {
          this.fileUpdated(f);
        }),
      );
  }

  renameFile(fileId: string, newName: string) {
    this.filesService.renameFile(fileId, { name: newName }).subscribe((f) => {
      this.fileStore.update(f.id, (entity) => {
        return {
          ...entity,
          name: f.name,
        };
      });
    });
  }

  lockFile(fileId: string) {
    this.filesService.lockFile(fileId).subscribe((f) => {
      this.fileUpdated(f);
    });
  }

  unlockFile(fileId: string) {
    this.filesService.unlockFile(fileId).subscribe((f) => {
      this.fileUpdated(f);
    });
  }

  adminLockFile(fileId: string) {
    this.filesService.administrativelyLockFile(fileId).subscribe((f) => {
      this.fileUpdated(f);
    });
  }

  adminUnlockFile(fileId: string) {
    this.filesService.administrativelyUnlockFile(fileId).subscribe((f) => {
      this.fileUpdated(f);
    });
  }

  forceUnlockFile(fileId: string) {
    this.filesService.forceUnlockFile(fileId).subscribe((f) => {
      this.fileUpdated(f);
    });
  }

  /**
   * Every change to a file from elsewhere comes through here (the server's events, the answer to a save, a file read
   * again), in whatever order they arrive, so one rule decides what the store and an open tab hold:
   * - an update older than the stored file, by the server's save time, is dropped, since it would put back old content;
   * - a tab with no unsaved edits follows the new content;
   * - a tab with unsaved edits keeps them, and stays unsaved until they match what is saved.
   */
  fileUpdated(file: ModelFile) {
    // Caster cannot restore a deleted file, so anything about one that arrives after its delete is older than it
    if (this.deleted.has(file.id)) {
      return;
    }
    const prev = this.fileQuery.getEntity(file.id);
    if (prev) {
      // The content and the other details (name, lock) are ordered apart: a rename stamps a save time without sending
      // content, so content saved before it can still arrive after it and be newer than the content held.
      // the time of the content held is the file's save time until an update without content moves that on
      if (prev.content != null && !this.contentSavedAt.has(file.id)) {
        this.contentSavedAt.set(file.id, prev.dateSaved);
      }
      const contentAt =
        prev.content == null ? undefined : this.contentSavedAt.get(file.id);
      const newerContent =
        file.content != null && !isOlder(file.dateSaved, contentAt);
      if (newerContent) {
        this.contentSavedAt.set(file.id, file.dateSaved);
      }
      if (isOlder(file.dateSaved, prev.dateSaved)) {
        // older details than those held: keep them, and take only content newer than that held
        if (!newerContent) {
          return;
        }
        file = { ...prev, content: file.content };
      }
    }
    // Updates that don't change the content (lock, unlock, rename) arrive with
    // content null. Keep the loaded content: a null makes the open tab reload
    // the file, and that reload overwrites unsaved edits.
    if (file.content == null && prev?.content != null) {
      file = { ...file, content: prev.content };
    }
    let editorContent = prev?.editorContent;
    if (prev?.lockedById && prev.lockedById !== file.lockedById) {
      // the lock was lost, so edits made under it can no longer be saved
      editorContent = file.content;
    } else if (file.content != null && !isFileContentChanged(prev)) {
      // a tab with no edits, or a file not opened yet, shows the content it is given
      editorContent = file.content;
    }
    this.upsertFile({ ...file, editorContent });
    // Unsaved edits stay unsaved through updates that don't touch them
    this.setSave(
      file.id,
      !isFileContentChanged(this.fileQuery.getEntity(file.id)),
    );
  }

  filesUpdated(files: ModelFile[]) {
    files.forEach((file) => {
      this.upsertFile(file);
      this.setSave(file.id, true);
    });
  }

  private upsertFile(file: ModelFile) {
    this.fileStore.upsert(
      file.id,
      (f) => ({
        ...file,
      }),
      (id, f) => ({
        id,
        ...f,
        content: file.content,
        editorContent: file.editorContent,
      }),
    );
  }

  updateEditorContent(fileId: string, editorContent: string) {
    const file = this.fileQuery.getEntity(fileId);
    const newFile = { ...file, editorContent } as ModelFile;
    this.fileStore.update(fileId, newFile);
    this.setSave(fileId, false);
  }

  delete(file: ModelFile) {
    this.filesService.deleteFile(file.id).subscribe(() => {
      this.fileDeleted(file.id);
    });
  }

  fileDeleted(fileId: string) {
    this.contentSavedAt.delete(fileId);
    this.deleted.add(fileId);
    this.fileStore.remove(fileId);
  }

  setActive(file: ModelFile | null) {
    // if id is null or undefined, a file or folder is active
    if (!file) {
      this.fileStore.setActive(null);
    } else {
      this.fileStore.setActive(file.id);
    }
  }

  setSave(id: string, value: boolean): void {
    this.fileStore.ui.upsert(id, { isSaved: value });
  }

  setSelectedVersionId(fileId: string, versionId: string) {
    this.fileStore.ui.upsert(fileId, (entity) => ({
      selectedVersionId: versionId,
    }));
  }

  export(id: string): Observable<FileDownload> {
    return this.filesService.exportFile(id, 'response').pipe(
      map((response) => {
        return {
          blob: response.body,
          filename: HttpHeaderUtils.getFilename(response.headers),
        };
      }),
    );
  }
}

/** Whether a save time is before another; a file with no save time is never older. */
function isOlder(
  saved: string | null | undefined,
  than: string | null | undefined,
): boolean {
  if (!saved || !than) {
    return false;
  }
  const [a, b] = [saveTime(saved), saveTime(than)];
  return a.seconds !== b.seconds
    ? a.seconds < b.seconds
    : a.fraction < b.fraction;
}

// The server sends save times to the tenth of a microsecond, past what Date keeps, so the fraction of a second is
// compared as digits.
function saveTime(value: string): { seconds: number; fraction: string } {
  const match = /^([^.]*?)(?:\.(\d+))?(Z|[+-]\d\d:?\d\d)?$/i.exec(value);
  const seconds = Date.parse((match?.[1] ?? value) + (match?.[3] ?? ''));
  return { seconds, fraction: (match?.[2] ?? '').padEnd(9, '0') };
}
