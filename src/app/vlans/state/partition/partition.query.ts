import { Injectable } from '@angular/core';
import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import { PartitionStore, PartitionState } from './partition.store';

@Injectable({ providedIn: 'root' })
@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
export class PartitionQuery extends QueryEntity<PartitionState> {
  constructor(protected store: PartitionStore) {
    super(store);
  }

  selectByPoolId(id: string, excludePartitionId: string = null) {
    return this.selectAll({
      filterBy: (x) => x.poolId == id && x.id != excludePartitionId,
    });
  }
}
