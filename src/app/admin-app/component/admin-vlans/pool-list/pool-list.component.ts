/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  inject,
  input,
} from '@angular/core';
import { Pool } from 'src/app/generated/caster-api';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { PoolListItemComponent } from '../pool-list-item/pool-list-item.component';

@Component({
  selector: 'cas-pool-list',
  templateUrl: './pool-list.component.html',
  styleUrls: ['./pool-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconButton, MatTooltip, MatIcon, PoolListItemComponent],
})
export class PoolListComponent implements OnInit {
  private poolService = inject(PoolService);

  readonly pools = input<Pool[]>(undefined);
  readonly canEdit = input<boolean>(undefined);

  @Output() poolSelected = new EventEmitter<Pool>();

  showDocumentation = false;

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
