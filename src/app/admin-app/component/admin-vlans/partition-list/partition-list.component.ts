/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  inject,
  input,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Partition } from 'src/app/generated/caster-api';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatAccordion } from '@angular/material/expansion';
import { PartitionComponent } from '../partition/partition.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-partition-list',
  templateUrl: './partition-list.component.html',
  styleUrls: ['./partition-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconButton,
    MatTooltip,
    MatIcon,
    MatAccordion,
    PartitionComponent,
    AsyncPipe,
  ],
})
export class PartitionListComponent implements OnInit {
  private vlanService = inject(VlanService);
  private partitionService = inject(PartitionService);
  private partitionQuery = inject(PartitionQuery);

  @Input()
  set poolId(id: string) {
    this._poolId = id;
    this.loadPool(id);
  }

  get poolId() {
    return this._poolId;
  }

  _poolId: string;

  readonly canEdit = input<boolean>(undefined);

  partitions$: Observable<Partition[]>;

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
