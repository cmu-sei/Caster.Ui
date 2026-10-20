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
} from '@angular/core';
import { Observable, of } from 'rxjs';
import { Pool } from 'src/app/generated/caster-api';
import { PoolQuery } from 'src/app/vlans/state/pool/pool.query';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { PoolListComponent } from '../pool-list/pool-list.component';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PartitionListComponent } from '../partition-list/partition-list.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-pools',
  templateUrl: './pools.component.html',
  styleUrls: ['./pools.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PoolListComponent,
    MatIconButton,
    MatIcon,
    PartitionListComponent,
    AsyncPipe,
  ],
})
export class PoolsComponent implements OnInit {
  private poolService = inject(PoolService);
  private poolQuery = inject(PoolQuery);

  @Input()
  canEdit: boolean;

  public pools$ = this.poolQuery.selectAll();

  public showPools = true;
  public selectedPool$: Observable<Pool>;

  ngOnInit(): void {
    this.poolService.load().subscribe();
  }

  selectPool(pool: Pool) {
    this.showPools = false;
    this.selectedPool$ = this.poolQuery.selectEntity(pool.id);
  }

  deselectPool() {
    this.showPools = true;
    this.selectedPool$ = of(null);
  }
}
