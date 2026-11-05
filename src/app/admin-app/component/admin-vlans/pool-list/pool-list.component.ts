/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
  MatNoDataRow,
} from '@angular/material/table';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Pool } from 'src/app/generated/caster-api';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { VlanQuery } from 'src/app/vlans/state/vlan/vlan.query';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { PartitionListComponent } from '../partition-list/partition-list.component';

/** Counts for a pool whose partitions and VLANs are in the stores. */
export interface PoolCounts {
  partitions: number;
  vlansInUse: number;
  vlans: number;
}

@Component({
  selector: 'cas-pool-list',
  templateUrl: './pool-list.component.html',
  styleUrls: ['./pool-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ),
    ]),
  ],
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
    MatTable,
    MatSort,
    MatSortHeader,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatNoDataRow,
    PartitionListComponent,
  ],
})
export class PoolListComponent {
  private poolService = inject(PoolService);
  private confirmService = inject(CrucibleDialogService);
  private dialog = inject(MatDialog);
  private partitionQuery = inject(PartitionQuery);
  private vlanQuery = inject(VlanQuery);

  readonly pools = input<Pool[]>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly isLoading = input<boolean>(false);

  readonly aboutPools =
    'Pools are groups of 4096 VLANs, each representing a standard switching ' +
    'infrastructure. Each Pool can be sub-divided into Partitions of various ' +
    'sizes. Partitions can be assigned to Projects and when a VLAN is ' +
    "requested in a Workspace, it will be pulled from the available VLANs in its Project's " +
    'assigned Partition. A system-wide Default Partition can be selected, ' +
    'which will cause VLANs to be allocated from that Partition if no ' +
    'Project or Partition are specified in a request.';

  readonly displayedColumns = [
    'actions',
    'name',
    'isDefault',
    'partitions',
    'vlans',
  ];
  readonly dataSource = new MatTableDataSource<Pool>([]);
  readonly sort = viewChild(MatSort);

  readonly filterString = signal('');
  expandedPoolId: string | null = null;

  private readonly partitions = toSignal(this.partitionQuery.selectAll(), {
    initialValue: [],
  });
  private readonly vlans = toSignal(this.vlanQuery.selectAll(), {
    initialValue: [],
  });

  /**
   * The stores only hold the partitions and VLANs of the pool last opened, so
   * only that pool has counts; the others show a dash.
   */
  readonly counts = computed(() => {
    const counts = new Map<string, PoolCounts>();
    for (const vlan of this.vlans()) {
      let c = counts.get(vlan.poolId);
      if (!c) {
        c = { partitions: 0, vlansInUse: 0, vlans: 0 };
        counts.set(vlan.poolId, c);
      }
      c.vlans++;
      if (vlan.inUse) {
        c.vlansInUse++;
      }
    }
    for (const partition of this.partitions()) {
      const c = counts.get(partition.poolId);
      if (c) {
        c.partitions++;
      }
    }
    return counts;
  });

  constructor() {
    this.dataSource.filterPredicate = (pool, filter) =>
      !!pool.name?.toLowerCase().includes(filter);
    effect(() => {
      this.dataSource.data = this.pools() ?? [];
    });
    effect(() => {
      this.dataSource.sort = this.sort() ?? null;
    });
    effect(() => {
      this.dataSource.filter = this.filterString().trim().toLowerCase();
    });
  }

  toggleExpand(poolId: string) {
    this.expandedPoolId = this.expandedPoolId === poolId ? null : poolId;
  }

  clearFilter() {
    this.filterString.set('');
  }

  createPool() {
    this.poolService.create().subscribe();
  }

  renamePool(pool: Pool) {
    const dialogRef = this.dialog.open(NameDialogComponent, {
      data: { nameValue: pool.name },
      minWidth: '400px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.title = 'Rename ' + pool.name;
    dialogRef.componentInstance.message = '';
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.poolService
          .partialEdit(pool.id, { name: result.nameValue })
          .subscribe();
      }
    });
  }

  deletePool(pool: Pool) {
    this.confirmService
      .confirm({
        title: 'Delete Pool',
        message: `Are you sure that you want to delete ${pool.name}?`,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.poolService.delete(pool.id, false).subscribe(
            () => {},
            (error) => {
              if (error?.status == 409) {
                this.confirmService
                  .confirm({
                    title: 'Delete Failed',
                    message: `${pool.name} has VLANs that are in use. Do you want to force delete it?`,
                  })
                  .afterClosed()
                  .subscribe((forceConfirmed) => {
                    if (forceConfirmed) {
                      this.poolService.delete(pool.id, true).subscribe();
                    }
                  });
              }
            },
          );
        }
      });
  }
}
