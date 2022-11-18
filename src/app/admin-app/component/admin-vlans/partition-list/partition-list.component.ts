/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { Partition, Vlan } from 'src/app/generated/caster-api';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { VlanQuery } from 'src/app/vlans/state/vlan/vlan.query';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';

@Component({
  selector: 'cas-partition-list',
  templateUrl: './partition-list.component.html',
  styleUrls: ['./partition-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartitionListComponent implements OnInit {
  @Input()
  set poolId(id: string) {
    this._poolId = id;
    this.loadPool(id);
  }

  get poolId() {
    return this._poolId;
  }

  _poolId: string;

  partitions$: Observable<Partition[]>;

  constructor(
    private vlanService: VlanService,
    private partitionService: PartitionService,
    private partitionQuery: PartitionQuery
  ) {}

  ngOnInit(): void {}

  loadPool(poolId: string) {
    this.vlanService.loadByPoolId(poolId).subscribe();
    this.partitionService.loadByPoolId(poolId).subscribe();
    this.partitions$ = this.partitionQuery.selectByPoolId(poolId);
  }

  createPartition() {
    this.partitionService.create(this.poolId).subscribe();
  }
}
