// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { FileService } from 'src/app/files/state';
import { FileDownload } from 'src/app/shared/models/file-download';
import HttpHeaderUtils from 'src/app/shared/utilities/http-header-utils';
import { WorkspaceService } from 'src/app/workspace/state';
import {
  ArchiveType,
  DirectoriesService,
  Directory,
  ModelFile,
  Workspace,
} from '../../generated/caster-api';
import { isUpdate } from '../../shared/utilities/functions';
import { DirectoryUI } from './directory.model';
import { DirectoryQuery } from './directory.query';
import { DirectoryStore } from './directory.store';

@Injectable({
  providedIn: 'root',
})
export class DirectoryService {
  constructor(
    private directoryStore: DirectoryStore,
    private directoryQuery: DirectoryQuery,
    private directoriesService: DirectoriesService,
    private fileService: FileService,
    private workspaceService: WorkspaceService
  ) {}

  loadDirectories(projectId: string): Observable<Directory[]> {
    return this.directoriesService
      .getDirectoriesByProject(projectId, true, true, false)
      .pipe(
        tap((directories) => {
          // First capture file and workspace data to load
          let files: ModelFile[] = [];
          let workspaces: Workspace[] = [];
          const directoryUIs = this.directoryQuery.ui.getAll();
          this.directoryStore.set(directories);
          directories.forEach((dir) => {
            const dUI = directoryUIs.find((d) => d.id === dir.id);
            if (dUI) {
              this.directoryStore.ui.upsert(dUI.id, dUI);
            }
            files = files.concat(dir.files);
            workspaces = workspaces.concat(dir.workspaces);
          });
          this.fileService.filesUpdated(files);
          this.workspaceService.setWorkspaces(workspaces);
        })
      );
  }

  add(directory: Directory) {
    this.directoriesService.createDirectory(directory).subscribe((dir) => {
      this.directoryStore.add(dir);
      const dirUI = this.directoryQuery.getEntity(dir.id);
      this.directoryStore.ui.upsert(dirUI.id, dirUI);
    });
  }

  update(directory: Directory) {
    this.directoriesService
      .editDirectory(directory.id, directory)
      .subscribe((dir) => {
        this.directoryStore.update(dir.id, dir);
      });
  }

  partialUpdate(id: string, directory: Partial<Directory>) {
    this.directoriesService
      .partialEditDirectory(id, directory)
      .subscribe((dir) => {
        this.directoryStore.update(dir.id, dir);
      });
  }

  delete(dirId: string) {
    this.directoriesService.deleteDirectory(dirId).subscribe(() => {
      this.deleted(dirId);
    });
  }

  updated(directory: Directory) {
    this.directoryStore.upsert(directory.id, directory);
  }

  deleted(dirId: string) {
    this.directoryStore.remove(dirId);
    this.directoryStore.ui.remove(dirId);
  }

  toggleIsExpanded(directoryUI: DirectoryUI) {
    this.directoryStore.ui.upsert(directoryUI.id, (d) => ({
      isExpanded: isUpdate<DirectoryUI>(d) ? !d.isExpanded : undefined,
    }));
  }

  toggleIsFilesExpanded(directoryUI: DirectoryUI) {
    this.directoryStore.ui.upsert(directoryUI.id, (d) => ({
      isFilesExpanded: isUpdate<DirectoryUI>(d)
        ? !d.isFilesExpanded
        : undefined,
    }));
  }

  toggleIsWorkspacesExpanded(directoryUI: DirectoryUI) {
    this.directoryStore.ui.upsert(directoryUI.id, (d) => ({
      isWorkspacesExpanded: isUpdate<DirectoryUI>(d)
        ? !d.isWorkspacesExpanded
        : undefined,
    }));
  }

  toggleIsDirectoriesExpanded(directoryUI: DirectoryUI) {
    this.directoryStore.ui.upsert(directoryUI.id, (d) => ({
      isDirectoriesExpanded: isUpdate<DirectoryUI>(d)
        ? !d.isDirectoriesExpanded
        : undefined,
    }));
  }

  export(
    id: string,
    archiveType: ArchiveType,
    includeIds: boolean
  ): Observable<FileDownload> {
    return this.directoriesService
      .exportDirectory(id, archiveType, includeIds, 'response')
      .pipe(
        map((response) => {
          return {
            blob: response.body,
            filename: HttpHeaderUtils.getFilename(response.headers),
          };
        })
      );
  }
}
