// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { PortalModule } from '@angular/cdk/portal';
import { CwdToolbarComponent } from './components/cwd-toolbar/cwd-toolbar.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { CwdToolbarNavigationItemComponent } from './components/cwd-toolbar-navigation-item/cwd-toolbar-navigation-item.component';
import { CwdToolbarActionItemComponent } from './components/cwd-toolbar-action-item/cwd-toolbar-action-item.component';

@NgModule({
  declarations: [
    CwdToolbarComponent,
    CwdToolbarNavigationItemComponent,
    CwdToolbarActionItemComponent,
  ],
  imports: [CommonModule, FlexLayoutModule, MatToolbarModule, PortalModule],
  exports: [
    CwdToolbarComponent,
    CwdToolbarNavigationItemComponent,
    CwdToolbarActionItemComponent,
  ],
})
export class CwdToolbarModule {}
