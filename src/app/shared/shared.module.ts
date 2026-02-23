// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { TopbarComponent } from './components/top-bar/topbar.component';
import { CrucibleHotkeyDirective } from './directives/crucible-hotkey.directive';

@NgModule({
  declarations: [CrucibleHotkeyDirective, TopbarComponent],
  imports: [
    CommonModule,
    MatToolbarModule,
    MatMenuModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    RouterModule,
  ],
  exports: [CrucibleHotkeyDirective, TopbarComponent],
})
export class SharedModule {}
