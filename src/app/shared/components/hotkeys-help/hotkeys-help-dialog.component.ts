// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { HotkeysService } from '@ngneat/hotkeys';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogActionsDirective,
} from '@cmusei/crucible-common';
import { MatButton } from '@angular/material/button';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-hotkeys-help-dialog',
  templateUrl: './hotkeys-help-dialog.component.html',
  styleUrls: ['./hotkeys-help-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    MatButton,
    TitleCasePipe,
  ],
})
export class HotkeysHelpDialogComponent {
  hotkeys = this.hotkeysService.getShortcuts();

  constructor(
    private hotkeysService: HotkeysService,
    private dialogRef: MatDialogRef<HotkeysHelpDialogComponent>,
  ) {}

  close() {
    this.dialogRef.close();
  }
}
