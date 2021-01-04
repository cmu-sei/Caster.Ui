// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityUIQuery,
  HashMap,
  Order,
  QueryConfig,
  QueryEntity,
} from '@datorama/akita';
import { PermissionsState, PermissionStore } from './permission.store';
import { Permission } from '../../generated/caster-api';
import { Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export const MODULE_QUERY_TOKEN = new InjectionToken('PermissionQuery');
@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class PermissionQuery extends QueryEntity<PermissionsState> {
  isLoading$ = this.select((state) => state.loading);

  constructor(protected store: PermissionStore) {
    super(store);
  }

  selectByPermissionId(id: string): Observable<Permission> {
    return this.selectEntity(id);
  }
}
