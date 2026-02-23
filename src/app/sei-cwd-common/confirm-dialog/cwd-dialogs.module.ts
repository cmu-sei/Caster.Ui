// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { ConfirmDialogComponent } from './components/confirm-dialog.component';
import { ConfirmDialogService } from './service/confirm-dialog.service';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [ConfirmDialogComponent],
  exports: [],
  imports: [
    CommonModule,
    MatDialogModule,
    MatCheckboxModule,
    MatButtonModule,
    MatTooltipModule,
    FormsModule,
  ],
  entryComponents: [ConfirmDialogComponent],
  providers: [ConfirmDialogService],
})
export class CwdDialogsModule {}
