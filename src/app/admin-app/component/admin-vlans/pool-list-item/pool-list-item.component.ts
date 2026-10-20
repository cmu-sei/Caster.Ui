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
  inject,
} from '@angular/core';
import { Pool } from 'src/app/generated/caster-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { MatCard, MatCardTitle, MatCardActions } from '@angular/material/card';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIconButton } from '@angular/material/button';

@Component({
  selector: 'cas-pool-list-item',
  templateUrl: './pool-list-item.component.html',
  styleUrls: ['./pool-list-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatCardTitle,
    MatFormField,
    MatInput,
    MatIcon,
    MatTooltip,
    MatCardActions,
    MatIconButton,
  ],
})
export class PoolListItemComponent implements OnInit {
  private confirmService = inject(CrucibleDialogService);
  private poolService = inject(PoolService);

  @Input() pool: Pool;
  @Input() canEdit: boolean;

  @Output() poolSelected = new EventEmitter<Pool>();

  @ViewChild('nameInput') nameInput: ElementRef<Input>;

  editing: boolean;

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
            },
          );
        }
      });
  }

  selectPool(pool: Pool) {
    this.poolSelected.emit(pool);
  }
}
