// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { FileVersionStore } from './fileVersion.store';
import { Injectable, InjectionToken } from '@angular/core';
import {
  FilesService,
  FileVersion,
  CreateSnippetCommand,
} from '../../generated/caster-api';
import { tap, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileVersionService {
  constructor(
    private fileVersionStore: FileVersionStore,
    private filesService: FilesService
  ) {}

  load(fileId: string): Observable<FileVersion[]> {
    this.fileVersionStore.setLoading(true);
    return this.filesService.getFileVersions(fileId).pipe(
      tap((versions: FileVersion[]) => {
        versions.forEach((version) => {
          this.fileVersionStore.upsert(version.id, version);
        });
      }),
      tap(() => {
        this.fileVersionStore.setLoading(false);
      })
    );
  }

  loadFileVersionById(id: string): Observable<FileVersion> {
    this.fileVersionStore.setLoading(true);
    return this.filesService.getFileVersion(id).pipe(
      tap((version: FileVersion) => {
        this.fileVersionStore.upsert(version.id, { ...version });
      }),
      tap(() => {
        this.fileVersionStore.setLoading(false);
      })
    );
  }

  tagFiles(tag: string, fileIds: string[]) {
    this.fileVersionStore.setLoading(true);
    return this.filesService
      .tagFiles({ tag, fileIds })
      .pipe(take(1))
      .subscribe((versions) => {
        versions.forEach((version) => {
          this.fileVersionStore.upsert(version.id, version);
        });
      });
  }

  toggleSelected(id: string) {
    this.fileVersionStore.ui.upsert(id, (entity) => ({
      isSelected: !entity.isSelected,
    }));
  }

  setActive(id) {
    this.fileVersionStore.setActive(id);
    this.fileVersionStore.ui.setActive(id);
  }
}
