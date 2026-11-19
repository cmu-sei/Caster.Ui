// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Injectable, inject } from '@angular/core';
import { SystemMessageComponent } from '../components/system-message.component';

@Injectable()
export class SystemMessageService {
  private messageSheet = inject(MatBottomSheet);
  // Title and message of the sheet that is open, so a repeat of it is not opened again.
  private shown: string | null = null;

  public displayMessage(
    title: string,
    message: string,
    displayAfterMs: number = 0,
  ) {
    setTimeout(() => {
      const key = JSON.stringify([title, message]);
      if (key === this.shown) {
        return;
      }
      this.shown = key;
      this.messageSheet
        .open(SystemMessageComponent, {
          data: { title, message },
        })
        .afterDismissed()
        .subscribe(() => {
          if (this.shown === key) {
            this.shown = null;
          }
        });
    }, displayAfterMs);
  }
}
