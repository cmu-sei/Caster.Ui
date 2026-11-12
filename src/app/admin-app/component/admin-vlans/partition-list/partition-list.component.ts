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
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Partition, Vlan } from 'src/app/generated/caster-api';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { VlanQuery } from 'src/app/vlans/state/vlan/vlan.query';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatAccordion } from '@angular/material/expansion';
import { PartitionComponent } from '../partition/partition.component';
import { VlanListComponent } from '../vlan-list/vlan-list.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-partition-list',
  templateUrl: './partition-list.component.html',
  styleUrls: ['./partition-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatIconButton,
    MatTooltip,
    MatIcon,
    MatAccordion,
    PartitionComponent,
    VlanListComponent,
    AsyncPipe,
  ],
})
export class PartitionListComponent implements OnInit {
  private vlanService = inject(VlanService);
  private partitionService = inject(PartitionService);
  private partitionQuery = inject(PartitionQuery);
  private vlanQuery = inject(VlanQuery);

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
  /** The pool's VLANs that are not in any partition. */
  unassigned$: Observable<Vlan[]>;
  readonly showUnassigned = signal(false);
  readonly vlansLoading$ = inject(VlanQuery).selectLoading();

  ngOnInit(): void {}

  loadPool(poolId: string) {
    this.vlanService.loadByPoolId(poolId).subscribe();
    this.partitionService.loadByPoolId(poolId).subscribe();
    this.partitions$ = this.partitionQuery.selectByPoolId(poolId);
    this.unassigned$ = this.vlanQuery.selectUnassignedByPoolId(poolId);
  }

  createPartition() {
    this.partitionService.create(this.poolId).subscribe();
  }
}
