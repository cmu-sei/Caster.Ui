// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Injectable, inject } from '@angular/core';
import { SystemMessageComponent } from '../components/system-message.component';

@Injectable()
export class SystemMessageService {
  private messageSheet = inject(MatBottomSheet);
  // The sheet that is open and its title and message, so a repeat of it is not
  // opened again.
  private shown: { key: string; sheet: unknown } | null = null;

  public displayMessage(
    title: string,
    message: string,
    displayAfterMs: number = 0,
  ) {
    setTimeout(() => {
      const key = JSON.stringify([title, message]);
      if (key === this.shown?.key) {
        return;
      }
      const sheet = this.messageSheet.open(SystemMessageComponent, {
        data: { title, message },
      });
      this.shown = { key, sheet };
      sheet.afterDismissed().subscribe(() => {
        // Only the sheet that is still current clears the mark, so a replaced
        // sheet finishing its exit does not unmark a newer one.
        if (this.shown?.sheet === sheet) {
          this.shown = null;
        }
      });
    }, displayAfterMs);
  }
}
