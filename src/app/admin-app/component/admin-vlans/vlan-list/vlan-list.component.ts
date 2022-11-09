import { SelectionModel } from '@angular/cdk/collections';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Observable } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { Partition, Vlan } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-vlan-list',
  templateUrl: './vlan-list.component.html',
  styleUrls: ['./vlan-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VlanListComponent implements OnInit {
  @Input() showUnassigned = true;
  @Input() partitions: Partition[];

  @Input() set vlans(vlans: Vlan[]) {
    this._vlans = vlans;
    this.dataSource.data = vlans.sort((a, b) => a.vlanId - b.vlanId);
    this.calculateTableHeight();

    // deselect items if they no longer exist in the data
    this.selection.selected.forEach((x) => {
      if (!vlans.map((y) => y.id).includes(x.id)) {
        this.selection.deselect(x);
      }
    });
  }

  get vlans() {
    return this._vlans;
  }

  _vlans: Vlan[];
  dataSource = new TableVirtualScrollDataSource<Vlan>();
  selection = new SelectionModel<Vlan>(true, []);
  displayedColumns: string[] = [
    'select',
    'vlanId',
    'inUse',
    'reserved',
    'tag',
    'actions',
  ];
  loading = new Map<string, boolean>();
  editingId: string;

  public itemSize = 48;
  public headerSize = 56;
  public maxSize = this.itemSize * 7;
  public tableHeight = '0px';
  public readonly unassigned = 'UNASSIGNED';

  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private confirmService: ConfirmDialogService,
    private vlanService: VlanService
  ) {}

  ngOnInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = function (data, filter: string): boolean {
      return (
        data.vlanId.toString().toLowerCase().includes(filter) ||
        data.inUse.toString().toLowerCase().includes(filter) ||
        data.reserved.toString().toLowerCase().includes(filter) ||
        data.tag?.toLowerCase().includes(filter)
      );
    };
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
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
              this.selection.selected.map((x) => x.id),
              this.selection.selected[0].partitionId,
              toPartitionId == this.unassigned ? null : toPartitionId
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

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource.data);
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
