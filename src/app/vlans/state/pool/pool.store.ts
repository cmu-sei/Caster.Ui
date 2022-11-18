/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Pool } from 'src/app/generated/caster-api';

export interface PoolState extends EntityState<Pool, string> {}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'pool' })
export class PoolStore extends EntityStore<PoolState> {
  constructor() {
    super();
  }
}
