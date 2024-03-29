/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import { VariablesStore, VariablesState } from './variables.store';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({ providedIn: 'root' })
export class VariablesQuery extends QueryEntity<VariablesState> {
  constructor(protected store: VariablesStore) {
    super(store);
  }

  selectByDesignId(designId: string) {
    return this.selectAll({ filterBy: (x) => x.designId == designId });
  }
}
