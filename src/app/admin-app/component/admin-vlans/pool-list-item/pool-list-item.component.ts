/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { Pool } from 'src/app/generated/caster-api';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';

@Component({
  selector: 'cas-pool-list-item',
  templateUrl: './pool-list-item.component.html',
  styleUrls: ['./pool-list-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoolListItemComponent implements OnInit {
  @Input() pool: Pool;

  @Output() poolSelected = new EventEmitter<Pool>();

  @ViewChild('nameInput') nameInput: Input;

  editing: boolean;

  constructor(
    private confirmService: ConfirmDialogService,
    private poolService: PoolService
  ) {}

  ngOnInit(): void {}

  rename(target) {
    this.poolService
      .partialEdit(this.pool.id, { name: target.value })
      .subscribe(() => (this.editing = false));
  }

  deletePool(pool: Pool) {
    this.confirmService
      .confirmDialog(
        'Delete Pool',
        `Are you sure you want to delete ${pool.name}?`
      )
      .subscribe((x) => {
        if (!x.wasCancelled) {
          this.poolService.delete(pool.id, false).subscribe(
            () => {},
            (error) => {
              if (error?.status == 409) {
                this.confirmService
                  .confirmDialog(
                    'Delete Failed',
                    `${pool.name} has VLANs that are in use. Do you want to force delete it?`
                  )
                  .subscribe((x) => {
                    if (!x.wasCancelled) {
                      this.poolService.delete(pool.id, true).subscribe();
                    }
                  });
              }
            }
          );
        }
      });
  }

  selectPool(pool: Pool) {
    this.poolSelected.emit(pool);
  }
}
