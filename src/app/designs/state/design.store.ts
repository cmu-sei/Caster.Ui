import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Design } from 'src/app/generated/caster-api';

export interface DesignState extends EntityState<Design> {}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'designs' })
export class DesignStore extends EntityStore<DesignState> {
  constructor() {
    super();
  }
}
