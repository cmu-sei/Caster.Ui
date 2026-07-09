// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { HotkeysHelpDialogComponent } from './components/hotkeys-help/hotkeys-help-dialog.component';
import { TopbarComponent } from './components/top-bar/topbar.component';
import { CrucibleHotkeyDirective } from './directives/crucible-hotkey.directive';

@NgModule({
  declarations: [
    CrucibleHotkeyDirective,
    TopbarComponent,
    HotkeysHelpDialogComponent,
  ],
  imports: [
    CommonModule,
    MatToolbarModule,
    MatMenuModule,
    MatButtonModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatIconModule,
    RouterModule,
    A11yModule,
    ...CRUCIBLE_DIALOG_IMPORTS,
  ],
  exports: [CrucibleHotkeyDirective, TopbarComponent, HotkeysHelpDialogComponent],
})
export class SharedModule {}
