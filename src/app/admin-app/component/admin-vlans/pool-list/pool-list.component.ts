/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { Pool } from 'src/app/generated/caster-api';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';

@Component({
  selector: 'cas-pool-list',
  templateUrl: './pool-list.component.html',
  styleUrls: ['./pool-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolListComponent implements OnInit {
  @Input() pools: Pool[];

  @Output() poolSelected = new EventEmitter<Pool>();

  showDocumentation = false;

  constructor(private poolService: PoolService) {}

  ngOnInit(): void {}

  createPool() {
    this.poolService.create().subscribe();
  }

  selectPool(pool: Pool) {
    this.poolSelected.emit(pool);
  }

  toggleDocumentation() {
    this.showDocumentation = !this.showDocumentation;
  }
}
