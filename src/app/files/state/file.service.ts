// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { FileDownload } from 'src/app/shared/models/file-download';
import HttpHeaderUtils from 'src/app/shared/utilities/http-header-utils';
import { FilesService, ModelFile } from '../../generated/caster-api';
import { FileQuery } from './file.query';
import { FileStore } from './file.store';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  constructor(
    private fileStore: FileStore,
    private fileQuery: FileQuery,
    private filesService: FilesService
  ) {}

  loadFile(fileId: string): Observable<ModelFile> {
    return this.filesService.getFile(fileId).pipe(
      tap((file) => {
        file.editorContent = file.content;
        this.fileStore.upsert(file.id, file);
        this.setSave(fileId, true);
      })
    );
  }

  loadFilesByDirectory(directoryId: string): Observable<ModelFile[]> {
    return this.filesService.getFilesByDirectory(directoryId, false).pipe(
      tap((files) => {
        files.forEach((file) => {
          this.upsertFile(file);
          this.setSave(file.id, true);
        });
      })
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
    this.filesService.editFile(file.id, file).subscribe((f) => {
      this.fileUpdated(f);
    });
  }

  updateFileContent(fileId: string, fileContent: string): Observable<any> {
    return this.filesService
      .partialEditFile(fileId, { content: fileContent })
      .pipe(
        tap((f) => {
          this.fileUpdated(f);
        })
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

  fileUpdated(file: ModelFile) {
    this.upsertFile(file);
    this.setSave(file.id, true);
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
      })
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
      })
    );
  }
}
