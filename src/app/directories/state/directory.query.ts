// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  QueryEntity,
  EntityUIQuery,
  QueryConfig,
  Order,
} from '@datorama/akita';
import {
  DirectoryUIState,
  DirectoryState,
  DirectoryStore,
} from './directory.store';
import { Injectable } from '@angular/core';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class DirectoryQuery extends QueryEntity<DirectoryState> {
  ui: EntityUIQuery<DirectoryUIState>;

  constructor(protected store: DirectoryStore) {
    super(store);
    this.createUIQuery();
  }
}
