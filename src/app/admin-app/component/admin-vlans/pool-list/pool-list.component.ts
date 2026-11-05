/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Pool } from 'src/app/generated/caster-api';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { PoolListItemComponent } from '../pool-list-item/pool-list-item.component';

@Component({
  selector: 'cas-pool-list',
  templateUrl: './pool-list.component.html',
  styleUrls: ['./pool-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatIconButton,
    MatTooltip,
    MatIcon,
    MatFormField,
    MatInput,
    MatSuffix,
    MatCard,
    MatProgressSpinner,
    PoolListItemComponent,
  ],
})
export class PoolListComponent {
  private poolService = inject(PoolService);

  readonly pools = input<Pool[]>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly isLoading = input<boolean>(false);

  readonly poolSelected = output<Pool>();

  readonly aboutPools =
    'Pools are groups of 4096 VLANs, each representing a standard switching ' +
    'infrastructure. Each Pool can be sub-divided into Partitions of various ' +
    'sizes. Partitions can be assigned to Projects and when a VLAN is ' +
    "requested in a Workspace, it will be pulled from the available VLANs in its Project's " +
    'assigned Partition. A system-wide Default Partition can be selected, ' +
    'which will cause VLANs to be allocated from that Partition if no ' +
    'Project or Partition are specified in a request.';

  readonly filterString = signal('');

  readonly filteredPools = computed(() => {
    const filter = this.filterString().trim().toLowerCase();
    const pools = this.pools() ?? [];
    return filter
      ? pools.filter((p) => p.name?.toLowerCase().includes(filter))
      : pools;
  });

  createPool() {
    this.poolService.create().subscribe();
  }

  selectPool(pool: Pool) {
    this.poolSelected.emit(pool);
  }

  clearFilter() {
    this.filterString.set('');
  }
}
