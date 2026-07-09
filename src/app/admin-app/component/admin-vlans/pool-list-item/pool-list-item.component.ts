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
  ElementRef,
} from '@angular/core';
import { Pool } from 'src/app/generated/caster-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';

@Component({
    selector: 'cas-pool-list-item',
    templateUrl: './pool-list-item.component.html',
    styleUrls: ['./pool-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class PoolListItemComponent implements OnInit {
  @Input() pool: Pool;
  @Input() canEdit: boolean;

  @Output() poolSelected = new EventEmitter<Pool>();

  @ViewChild('nameInput') nameInput: ElementRef<Input>;

  editing: boolean;

  constructor(
    private confirmService: CrucibleDialogService,
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
      .confirm({
        title: 'Delete Pool',
        message: `Are you sure you want to delete ${pool.name}?`,
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
            }
          );
        }
      });
  }

  selectPool(pool: Pool) {
    this.poolSelected.emit(pool);
  }
}
