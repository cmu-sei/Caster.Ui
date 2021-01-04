// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, Inject } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';

@Component({
  selector: 'app-system-message',
  templateUrl: './system-message.component.html',
  styleUrls: ['./system-message.component.css'],
})
export class SystemMessageComponent implements OnInit {
  public displayTitle: string;
  public displayMessage: string;

  constructor(
    public messageSheet: MatBottomSheetRef<SystemMessageComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any
  ) {
    this.displayTitle = data.title;
    this.displayMessage = data.message;
  }

  ngOnInit() {}

  close() {
    this.messageSheet.dismiss();
  }
}
