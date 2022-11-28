/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

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
