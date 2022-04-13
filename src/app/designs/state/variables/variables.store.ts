/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Variable } from 'src/app/generated/caster-api';

export interface VariablesState extends EntityState<Variable, string> {}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'variables' })
export class VariablesStore extends EntityStore<VariablesState> {
  constructor() {
    super();
  }
}
