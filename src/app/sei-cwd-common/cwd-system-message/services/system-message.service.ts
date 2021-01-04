// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Injectable } from '@angular/core';
import { SystemMessageComponent } from '../components/system-message.component';

@Injectable()
export class SystemMessageService {
  constructor(private messageSheet: MatBottomSheet) {}

  public displayMessage(
    title: string,
    message: string,
    displayAfterMs: number = 0
  ) {
    setTimeout(() => {
      this.messageSheet.open(SystemMessageComponent, {
        data: { title, message },
      });
    }, displayAfterMs);
  }
}
