// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityUIQuery,
  Order,
  QueryConfig,
  QueryEntity,
} from '@datorama/akita';
import {
  FileVersionsState,
  FileVersionStore,
  FileVersionUIState,
} from './fileVersion.store';
import { FileVersion } from '../../generated/caster-api';
import { Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export const MODULE_QUERY_TOKEN = new InjectionToken('FileVersionQuery');
@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class FileVersionQuery extends QueryEntity<FileVersionsState> {
  ui: EntityUIQuery<FileVersionUIState>;
  isLoading$ = this.select((state) => state.loading);

  constructor(protected store: FileVersionStore) {
    super(store);
    this.createUIQuery();
  }

  selectByFileVersionId(id: string): Observable<FileVersion> {
    return this.selectEntity(id);
  }
}
