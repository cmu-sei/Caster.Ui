/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  input,
} from '@angular/core';
import { PoolQuery } from 'src/app/vlans/state/pool/pool.query';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { PoolListComponent } from '../pool-list/pool-list.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-pools',
  templateUrl: './pools.component.html',
  styleUrls: ['./pools.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PoolListComponent, AsyncPipe],
})
export class PoolsComponent implements OnInit {
  private poolService = inject(PoolService);
  private poolQuery = inject(PoolQuery);

  readonly canEdit = input<boolean>(undefined);

  public pools$ = this.poolQuery.selectAll();
  public isLoading$ = this.poolQuery.selectLoading();

  ngOnInit(): void {
    this.poolService.load().subscribe();
  }
}
