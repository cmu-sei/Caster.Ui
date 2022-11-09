import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { VlanStore, VlanState } from './vlan.store';

@Injectable({ providedIn: 'root' })
export class VlanQuery extends QueryEntity<VlanState> {
  constructor(protected store: VlanStore) {
    super(store);
  }

  selectByPoolId(id: string) {
    return this.selectAll({ filterBy: (x) => x.poolId == id });
  }

  selectUnassignedByPoolId(id: string) {
    return this.selectAll({
      filterBy: (x) => x.poolId == id && !x.partitionId,
    });
  }

  selectByPartitionId(id: string) {
    return this.selectAll({ filterBy: (x) => x.partitionId == id });
  }
}
