/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Partition } from 'src/app/generated/caster-api';

export interface PartitionState extends EntityState<Partition, string> {}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'partition' })
export class PartitionStore extends EntityStore<PartitionState> {
  constructor() {
    super();
  }
}
