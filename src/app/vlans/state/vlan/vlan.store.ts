import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Vlan } from 'src/app/generated/caster-api';

export interface VlanState extends EntityState<Vlan, string> {}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'vlan' })
export class VlanStore extends EntityStore<VlanState> {
  constructor() {
    super();
  }
}
