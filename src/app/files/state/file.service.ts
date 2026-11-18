// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { defer, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { FileDownload } from 'src/app/shared/models/file-download';
import HttpHeaderUtils from 'src/app/shared/utilities/http-header-utils';
import { FilesService, ModelFile } from '../../generated/caster-api';
import { isFileContentChanged, isSameContent } from './file-content';
import { FileQuery } from './file.query';
import { FileStore } from './file.store';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  private fileStore = inject(FileStore);
  private fileQuery = inject(FileQuery);
  private filesService = inject(FilesService);

  loadFile(fileId: string): Observable<ModelFile> {
    return this.filesService.getFile(fileId).pipe(
      tap((file) => {
        file.editorContent = file.content;
        this.fileStore.upsert(file.id, file);
        this.setSave(fileId, true);
      }),
    );
  }

  /** The files whose open editor holds edits that are not saved, to ask before something else saves them. */
  editedFileIds(): Set<string> {
    return new Set(
      this.fileQuery
        .getAll()
        .filter((f) => isFileContentChanged(f))
        .map((f) => f.id),
    );
  }

  /**
   * Reads a file again after something else saved it. Edits the user had, or makes while the read is in flight, are
   * kept, and an answer older than a save the user made meanwhile is dropped.
   * @param wasEdited whether the editor held unsaved edits when the change was started
   * @param editorAtStart the editor's content when the change was started, to tell typing since from the file's own event
   */
  refreshFile(
    fileId: string,
    wasEdited = false,
    editorAtStart?: string,
  ): Observable<ModelFile> {
    return defer(() => {
      const before = this.fileQuery.getEntity(fileId);
      return (this.filesService.getFile(fileId) as Observable<ModelFile>).pipe(
        tap((file: ModelFile) => {
          const current = this.fileQuery.getEntity(fileId);
          const typed = current?.editorContent !== before?.editorContent;
          // saved since the read began, so the buffer now equals the content: that save is newer than this answer
          if (
            current &&
            current.content !== before?.content &&
            isSameContent(current.editorContent, current.content)
          ) {
            return;
          }
          // edits held when Apply was pressed, typed since, or typed while the read ran
          const typedSince =
            editorAtStart !== undefined &&
            before?.editorContent !== editorAtStart;
          const edited = wasEdited || typedSince || typed;
          this.fileStore.upsert(file.id, {
            ...file,
            editorContent: edited ? current?.editorContent : file.content,
          });
          this.setSave(
            fileId,
            !edited || isSameContent(current?.editorContent, file.content),
          );
        }),
      );
    });
  }

  /**
   * Files an AI draft saved: an open tab shows them, unless it held edits that were not saved when the draft was
   * started, which stay in the editor.
   * @param edited the files with unsaved edits when the draft was started, from editedFileIds
   */
  aiFilesSaved(files: ModelFile[], edited = new Set<string>()) {
    files.forEach((file) => {
      if (edited.has(file.id)) {
        // the saved content is the new one, the editor keeps what the user typed
        const saved = { ...file };
        delete saved.editorContent;
        this.fileUpdated(saved);
        this.setSave(
          file.id,
          !isFileContentChanged(this.fileQuery.getEntity(file.id)),
        );
      } else {
        // the file's own SignalR event may have arrived first, leaving the old buffer beside the new content
        this.fileUpdated({ ...file, editorContent: file.content });
        this.setSave(file.id, true);
      }
    });
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

  fileUpdated(file: ModelFile) {
    const prev = this.fileQuery.getEntity(file.id);
    // Updates that don't change the content (lock, unlock, rename) arrive with
    // content null. Keep the loaded content: a null makes the open tab reload
    // the file, and that reload overwrites unsaved edits.
    if (file.content == null && prev?.content != null) {
      file = { ...file, content: prev.content };
    }
    if (prev?.lockedById && prev.lockedById !== file.lockedById) {
      file = { ...file, editorContent: file.content };
    }
    this.upsertFile(file);
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
