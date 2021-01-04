// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityUIQuery,
  QueryEntity,
  QueryConfig,
  Order,
} from '@datorama/akita';
import { FileState, FileStore, FileUIState } from './file.store';
import { Injectable } from '@angular/core';
import { ModelFile } from '../../generated/caster-api';
import { Observable } from 'rxjs';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class FileQuery extends QueryEntity<FileState, ModelFile> {
  ui: EntityUIQuery<FileUIState>;
  constructor(protected store: FileStore) {
    super(store);
    this.createUIQuery();
  }
  getSelectedVersionId(fileId: string): Observable<string> {
    return this.ui.selectEntity(fileId, (entity) => entity.selectedVersionId);
  }

  isEditing(fileId: string, userId: string): Observable<boolean> {
    return this.selectEntity(fileId, (entity) => entity.lockedById === userId);
  }
  // Observable Response
  selectIsSaved(fileId: string): Observable<boolean> {
    return this.ui.selectEntity(fileId, (entity) => entity.isSaved);
  }
  // Value Response
  isSaved(fileId: string): boolean {
    return this.ui.getEntity(fileId).isSaved;
  }
}
