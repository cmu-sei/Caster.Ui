/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Pool } from 'src/app/generated/caster-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { MatCard, MatCardTitle, MatCardActions } from '@angular/material/card';
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
    MatIcon,
    MatTooltip,
    MatCardActions,
    MatIconButton,
  ],
})
export class PoolListItemComponent {
  private confirmService = inject(CrucibleDialogService);
  private poolService = inject(PoolService);
  private dialog = inject(MatDialog);

  readonly pool = input<Pool>(undefined);
  readonly canEdit = input<boolean>(undefined);

  readonly poolSelected = output<Pool>();

  rename() {
    const pool = this.pool();
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

  selectPool(pool: Pool) {
    this.poolSelected.emit(pool);
  }
}
