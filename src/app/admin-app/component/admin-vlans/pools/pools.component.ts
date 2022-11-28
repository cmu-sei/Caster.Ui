/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Pool } from 'src/app/generated/caster-api';
import { PoolQuery } from 'src/app/vlans/state/pool/pool.query';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';

@Component({
  selector: 'cas-pools',
  templateUrl: './pools.component.html',
  styleUrls: ['./pools.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolsComponent implements OnInit {
  public pools$ = this.poolQuery.selectAll();

  public showPools = true;
  public selectedPool$: Observable<Pool>;

  constructor(private poolService: PoolService, private poolQuery: PoolQuery) {}

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
