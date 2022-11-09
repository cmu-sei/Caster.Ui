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
