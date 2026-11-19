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
import { Injectable, inject } from '@angular/core';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class DirectoryQuery extends QueryEntity<DirectoryState> {
  protected store: DirectoryStore;

  ui: EntityUIQuery<DirectoryUIState>;

  constructor() {
    const store = inject(DirectoryStore);

    super(store);
    this.store = store;

    this.createUIQuery();
  }
}
