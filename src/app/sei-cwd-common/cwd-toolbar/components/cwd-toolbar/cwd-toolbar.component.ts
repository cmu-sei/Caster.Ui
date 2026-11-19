// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component } from '@angular/core';
import { MatToolbar, MatToolbarRow } from '@angular/material/toolbar';

@Component({
  selector: 'cas-cwd-toolbar',
  templateUrl: './cwd-toolbar.component.html',
  styleUrls: ['./cwd-toolbar.component.scss'],
  imports: [MatToolbar, MatToolbarRow],
})
export class CwdToolbarComponent {}
