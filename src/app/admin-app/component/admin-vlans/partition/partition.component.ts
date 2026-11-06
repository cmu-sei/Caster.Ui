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
  input,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { Partition, Vlan } from 'src/app/generated/caster-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { VlanQuery } from 'src/app/vlans/state/vlan/vlan.query';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
  MatExpansionPanelDescription,
  MatExpansionPanelContent,
} from '@angular/material/expansion';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { ClipboardModule } from 'ngx-clipboard';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { VlanListComponent } from '../vlan-list/vlan-list.component';
import { VlanFeedbackService } from '../vlan-feedback.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-partition',
  templateUrl: './partition.component.html',
  styleUrls: ['./partition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIconButton,
    MatTooltip,
    MatIcon,
    ClipboardModule,
    MatFormField,
    MatInput,
    MatExpansionPanelDescription,
    MatExpansionPanelContent,
    VlanListComponent,
    AsyncPipe,
  ],
})
export class PartitionComponent implements OnInit {
  private partitionService = inject(PartitionService);
  private partitionQuery = inject(PartitionQuery);
  private vlanService = inject(VlanService);
  private vlanQuery = inject(VlanQuery);
  private confirmService = inject(CrucibleDialogService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private feedback = inject(VlanFeedbackService);

  @Input() set partition(partition: Partition) {
    this._partition = partition;
    this.vlans$ = this.vlanQuery.selectByPartitionId(partition.id);
    this.otherPartitions$ = this.partitionQuery.selectByPoolId(
      partition.poolId,
      partition.id,
    );
  }

  readonly canEdit = input<boolean>(undefined);

  get partition() {
    return this._partition;
  }

  _partition: Partition;

  vlans$: Observable<Vlan[]>;
  otherPartitions$: Observable<Partition[]>;

  get defaultTooltip(): string {
    return this.partition?.isDefault
      ? 'Stop using this as the Default Partition'
      : 'Make this the Default Partition: Projects without a partition take VLANs from it';
  }

  /** The VLAN count to add or remove: a whole number from 1 to 4096, else null. */
  readonly amount = signal<number | null>(null);

  ngOnInit(): void {}

  delete($event) {
    $event.stopPropagation();

    this.confirmService
      .confirm({
        title: 'Delete Partition',
        message: `Are you sure that you want to delete ${this.partition.name}?`,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          const name = this.partition.name;
          this.feedback
            .report(
              this.partitionService.delete(this.partition.id),
              `Deleted ${name}`,
              `Could not delete ${name}`,
            )
            .subscribe();
        }
      });
  }

  rename($event) {
    $event.stopPropagation();

    const partition = this.partition;
    const dialogRef = this.dialog.open(NameDialogComponent, {
      data: { nameValue: partition.name },
      minWidth: '400px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.title = 'Rename ' + partition.name;
    dialogRef.componentInstance.message = '';
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.feedback
          .report(
            this.partitionService.partialEdit(partition.id, {
              name: result.nameValue,
            }),
            `Renamed ${partition.name} to ${result.nameValue}`,
            `Could not rename ${partition.name}`,
          )
          .subscribe();
      }
    });
  }

  setAmount(value: string) {
    const amount = value.trim() === '' ? NaN : Number(value);
    this.amount.set(
      Number.isInteger(amount) && amount >= 1 && amount <= 4096 ? amount : null,
    );
  }

  addVlans($event: Event, input: HTMLInputElement) {
    $event.stopPropagation();
    const amount = this.amount();
    if (!amount) {
      return;
    }
    const name = this.partition.name;
    this.feedback
      .report(
        this.vlanService.addToPartition(this.partition.id, amount),
        (vlans) =>
          `Added ${VlanFeedbackService.vlans(vlans.length)} to ${name}`,
        `Could not add VLANs to ${name}`,
      )
      .subscribe(() => this.clearAmount(input));
  }

  removeVlans($event: Event, input: HTMLInputElement) {
    $event.stopPropagation();
    const amount = this.amount();
    if (!amount) {
      return;
    }
    const name = this.partition.name;
    this.feedback
      .report(
        this.vlanService.removeFromPartition(this.partition.id, amount),
        (vlans) =>
          `Removed ${VlanFeedbackService.vlans(vlans.length)} from ${name}`,
        `Could not remove VLANs from ${name}`,
      )
      .subscribe(() => this.clearAmount(input));
  }

  private clearAmount(input: HTMLInputElement) {
    input.value = '';
    this.amount.set(null);
  }

  unsetDefault($event, id: string) {
    $event.stopPropagation();
    if (this.canEdit()) {
      const name = this.partition.name;
      this.feedback
        .report(
          this.partitionService.unsetDefault(id),
          `${name} is no longer the default partition`,
          `Could not unset ${name} as the default partition`,
        )
        .subscribe();
    }
  }

  setDefault($event, id: string) {
    $event.stopPropagation();
    if (this.canEdit()) {
      const name = this.partition.name;
      this.feedback
        .report(
          this.partitionService.setDefault(id),
          `${name} is now the default partition`,
          `Could not make ${name} the default partition`,
        )
        .subscribe();
    }
  }

  onClipboardSuccess() {
    this.snackBar.open(
      `Copied the partition_id of ${this.partition.name}`,
      'Dismiss',
    );
  }
}
