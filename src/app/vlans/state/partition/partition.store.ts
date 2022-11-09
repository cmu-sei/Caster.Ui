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
