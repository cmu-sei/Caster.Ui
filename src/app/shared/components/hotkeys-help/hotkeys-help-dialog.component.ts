// Copyright 2025 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { HotkeysService } from '@ngneat/hotkeys';

@Component({
  selector: 'app-hotkeys-help-dialog',
  templateUrl: './hotkeys-help-dialog.component.html',
  styleUrls: ['./hotkeys-help-dialog.component.scss'],
  standalone: false,
})
export class HotkeysHelpDialogComponent {
  hotkeys = this.hotkeysService.getShortcuts();

  constructor(
    private hotkeysService: HotkeysService,
    private dialogRef: MatDialogRef<HotkeysHelpDialogComponent>
  ) {}

  close() {
    this.dialogRef.close();
  }
}
