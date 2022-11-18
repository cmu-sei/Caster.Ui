/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import { PoolStore, PoolState } from './pool.store';

@Injectable({ providedIn: 'root' })
@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
export class PoolQuery extends QueryEntity<PoolState> {
  constructor(protected store: PoolStore) {
    super(store);
  }
}
