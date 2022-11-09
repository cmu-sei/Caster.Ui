import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { Partition, Vlan } from 'src/app/generated/caster-api';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { VlanQuery } from 'src/app/vlans/state/vlan/vlan.query';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';

@Component({
  selector: 'cas-partition',
  templateUrl: './partition.component.html',
  styleUrls: ['./partition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartitionComponent implements OnInit {
  @Input() set poolId(poolId: string) {
    this.vlans$ = this.vlanQuery.selectUnassignedByPoolId(poolId);
    this.otherPartitions$ = this.partitionQuery.selectByPoolId(
      poolId,
      this.partition?.id
    );
  }

  @Input() set partition(partition: Partition) {
    this._partition = partition;
    this.vlans$ = this.vlanQuery.selectByPartitionId(partition.id);
    this.otherPartitions$ = this.partitionQuery.selectByPoolId(
      partition.poolId,
      partition.id
    );
  }

  get partition() {
    return this._partition;
  }

  _partition: Partition;

  editing: boolean;

  vlans$: Observable<Vlan[]>;
  otherPartitions$: Observable<Partition[]>;

  constructor(
    private partitionService: PartitionService,
    private partitionQuery: PartitionQuery,
    private vlanService: VlanService,
    private vlanQuery: VlanQuery,
    private confirmService: ConfirmDialogService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {}

  delete($event) {
    $event.stopPropagation();

    this.confirmService
      .confirmDialog(
        'Delete Partition',
        `Are you sure you want to delete ${this.partition.name}?`
      )
      .subscribe((x) => {
        if (!x.wasCancelled) {
          this.partitionService.delete(this.partition.id).subscribe();
        }
      });
  }

  rename($event, target) {
    $event.stopPropagation();

    this.partitionService
      .partialEdit(this.partition.id, { name: target.value })
      .subscribe(() => (this.editing = false));
  }

  addVlans($event, vlans) {
    $event.stopPropagation();
    this.vlanService.addToPartition(this.partition.id, vlans).subscribe();
  }

  removeVlans($event, vlans) {
    $event.stopPropagation();
    this.vlanService.removeFromPartition(this.partition.id, vlans).subscribe();
  }

  unsetDefault($event, id: string) {
    $event.stopPropagation();
    this.partitionService.unsetDefault(id).subscribe();
  }

  setDefault($event, id: string) {
    $event.stopPropagation();
    this.partitionService.setDefault(id).subscribe();
  }

  onClipboardSuccess() {
    this.snackBar.open('Copied to clipboard', 'Dismiss');
  }
}
