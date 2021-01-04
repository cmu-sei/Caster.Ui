// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityUIQuery,
  HashMap,
  Order,
  QueryConfig,
  QueryEntity,
} from '@datorama/akita';
import { ModulesState, ModuleStore, ModuleUIState } from './module.store';
import { Module } from '../../generated/caster-api';
import { Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export const MODULE_QUERY_TOKEN = new InjectionToken('ModuleQuery');
@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class ModuleQuery extends QueryEntity<ModulesState> {
  ui: EntityUIQuery<ModuleUIState>;
  isLoading$ = this.select((state) => state.loading);

  constructor(protected store: ModuleStore) {
    super(store);
    this.createUIQuery();
  }

  selectByModuleId(id: string): Observable<Module> {
    return this.selectEntity(id);
  }
}
