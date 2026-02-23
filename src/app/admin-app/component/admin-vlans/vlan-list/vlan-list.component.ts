/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { SelectionModel } from '@angular/cdk/collections';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  ViewChild,
  ChangeDetectorRef,
  OnChanges,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Observable, Subject } from 'rxjs';
import { debounceTime, finalize, take, takeUntil, tap } from 'rxjs/operators';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { Partition, Vlan } from 'src/app/generated/caster-api';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'cas-vlan-list',
  templateUrl: './vlan-list.component.html',
  styleUrls: ['./vlan-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VlanListComponent implements OnInit, OnChanges {
  @Input() showUnassigned = true;
  @Input() partitions: Partition[];
  @Input() canEdit: boolean;

  @Input() set vlans(vlans: Vlan[]) {
    this._vlans = vlans;
    this.dataSource.data = vlans.sort((a, b) => a.vlanId - b.vlanId);
    this.calculateTableHeight();

    // deselect items if they no longer exist in the data
    this.selection.selected.forEach((x) => {
      if (!vlans.map((y) => y.id).includes(x)) {
        this.selection.deselect(x);
      }
    });
  }

  get vlans() {
    return this._vlans;
  }

  _vlans: Vlan[];
  dataSource = new TableVirtualScrollDataSource<Vlan>();
  selection = new SelectionModel<string>(true, []);

  viewColumns = ['vlanId', 'inUse', 'reserved', 'tag'];
  preEditColumns = ['select'];
  postEditColumns = ['actions'];
  displayedColumns = this.viewColumns;
  loading = new Map<string, boolean>();
  editingId: string;
  filterControl = new FormControl('');

  public itemSize = 48;
  public headerSize = 56;
  public maxSize = this.itemSize * 7;
  public tableHeight = '0px';
  private unsubscribe$ = new Subject<void>();

  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private confirmService: ConfirmDialogService,
    private vlanService: VlanService
  ) {}

  ngOnInit(): void {
    this.filterControl.valueChanges
      .pipe(debounceTime(500), takeUntil(this.unsubscribe$))
      .subscribe((value) => {
        this.selection.clear();
        this.dataSource.filter = value?.trim().toLowerCase();
      });

    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = function (
      data: Vlan,
      filter: string
    ): boolean {
      if (!filter) {
        return true;
      }

      const terms = filter
        .split(',')
        .map((s) => s?.trim()?.toLowerCase())
        .filter((s) => s.length > 0);

      // find vlanId or vlanId range matches e.g. 1, 100-200
      const idMatches = terms.some((term) => {
        if (term.includes('-')) {
          const [start, end] = term.split('-').map(Number);
          if (!isNaN(start) && !isNaN(end)) {
            const min = Math.min(start, end);
            const max = Math.max(start, end);
            return data.vlanId >= min && data.vlanId <= max;
          }
        } else if (!isNaN(Number(term))) {
          return data.vlanId === Number(term);
        }
        return false;
      });

      // find tag matches
      const stringMatches = terms.some((term) => {
        if (!isNaN(Number(term)) || term.includes('-')) {
          return false;
        }

        return data.tag?.toLowerCase().includes(term);
      });

      return idMatches || stringMatches;
    };
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  ngOnChanges() {
    this.recalculateDisplayedColumns();
  }

  recalculateDisplayedColumns() {
    this.displayedColumns = [].concat(
      this.canEdit ? this.preEditColumns : [],
      this.viewColumns,
      this.canEdit ? this.postEditColumns : []
    );
  }

  clearFilter() {
    this.filterControl.setValue('');
  }

  toggleInUse(vlan: Vlan) {
    this.confirmService
      .confirmDialog(
        'Confirm VLAN',
        `Are you sure you want to set VLAN ${vlan.vlanId} to ${
          vlan.inUse ? 'Not In Use' : 'In Use'
        }?`
      )
      .subscribe((x) => {
        if (!x.wasCancelled) {
          if (vlan.inUse) {
            this.execute(vlan, this.vlanService.release(vlan));
          } else {
            this.execute(vlan, this.vlanService.acquire(vlan));
          }
        }
      });
  }

  toggleReserved(vlan: Vlan) {
    if (vlan.reserved) {
      this.execute(vlan, this.vlanService.unreserve(vlan));
    } else {
      this.execute(vlan, this.vlanService.reserve(vlan));
    }
  }

  removeFromPartition(vlan: Vlan) {
    this.confirmService
      .confirmDialog(
        'Confirm Remove',
        `Are you sure you want to remove VLAN ${vlan.vlanId} from this Partition?`
      )
      .subscribe((x) => {
        if (!x.wasCancelled) {
          this.execute(
            vlan,
            this.vlanService.reassign(
              [].concat(vlan.id),
              vlan.partitionId,
              null
            )
          );
        }
      });
  }

  reassignSelected(toPartitionId: string) {
    this.confirmService
      .confirmDialog(
        'Confirm Reassign',
        `Are you sure you want to reassign ${this.selection.selected.length} selected VLANs?`
      )
      .subscribe((x) => {
        if (!x.wasCancelled) {
          this.vlanService
            .reassign(
              this.selection.selected,
              this.vlans.find((x) => x.id == this.selection.selected[0])
                .partitionId,
              toPartitionId
            )
            .subscribe();
        }
      });
  }

  editTag(id: string, target) {
    this.vlanService
      .partialEdit(id, { tag: target.value })
      .subscribe(() => (this.editingId = null));
  }

  reserveSelected(reserve: boolean) {
    this.confirmService
      .confirmDialog(
        `Confirm ${reserve ? 'Reserve' : 'Unreserve'}`,
        `Are you sure you want to ${reserve ? 'reserve' : 'unreserve'} ${
          this.selection.selected.length
        } selected VLAN${this.selection.selected.length == 1 ? '' : 's'}?`
      )
      .subscribe((x) => {
        if (!x.wasCancelled) {
          this.vlanService
            .bulkReserve(reserve, this.selection.selected)
            .pipe(
              tap((x) => {
                if (!x.success) {
                  this.confirmService
                    .confirmDialog(
                      'Failure',
                      `The following ${
                        x.notUpdated.length
                      } Vlans were not successfully updated: ${this.vlans
                        .filter((y) => x.notUpdated.includes(y.id))
                        .map((x) => x.vlanId)}`,
                      {
                        buttonTrueText: '',
                        buttonFalseText: 'OK',
                      }
                    )
                    .subscribe();
                }
              })
            )
            .subscribe();
        }
      });
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.filteredData.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource.filteredData.map((x) => x.id));
  }

  calculateTableHeight() {
    const count = this.dataSource.filteredData.length;
    let height: number;
    height = this.headerSize * 1.2 + count * this.itemSize;

    if (height > this.maxSize) {
      height = this.maxSize;
    }

    this.tableHeight = `${height}px`;
  }

  private execute(vlan: Vlan, sub: Observable<any>) {
    this.loading.set(vlan.id, true);
    sub
      .pipe(
        take(1),
        finalize(() => {
          this.loading.set(vlan.id, false);
          this.changeDetector.markForCheck();
        })
      )
      .subscribe();
  }
}
