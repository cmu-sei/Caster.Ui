// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { MatDialogModule } from '@angular/material/dialog';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';

@NgModule({
  declarations: [ConfirmDialogComponent],
  exports: [],
  imports: [CommonModule, MatDialogModule, ...CRUCIBLE_DIALOG_IMPORTS],
})
export class DialogsModule {}
