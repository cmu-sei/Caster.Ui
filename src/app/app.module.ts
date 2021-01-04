// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { OverlayModule } from '@angular/cdk/overlay';
import { HttpClientModule } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  ComnAuthModule,
  ComnSettingsConfig,
  ComnSettingsModule,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { HotkeysModule } from '@ngneat/hotkeys';
import { environment } from '../environments/environment';
import { AdminAppModule } from './admin-app/admin-app.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ApiModule, BASE_PATH } from './generated/caster-api';
import { ProjectModule } from './project/project.module';
import { ErrorService } from './sei-cwd-common/cwd-error/error.service';
import { SystemMessageComponent } from './sei-cwd-common/cwd-system-message/components/system-message.component';
import { SystemMessageService } from './sei-cwd-common/cwd-system-message/services/system-message.service';
import { CwdToolbarModule } from './sei-cwd-common/cwd-toolbar/cwd-toolbar.module';

export const settings: ComnSettingsConfig = {
  url: `assets/config/settings.json`,
  envUrl: `assets/config/settings.env.json`,
};

// since the generated api code is a separate module we will set the BASE_PATH here in the global app module.
export function getBasePath(settings: ComnSettingsService) {
  return settings.settings.ApiUrl;
}

@NgModule({
  declarations: [AppComponent, SystemMessageComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    environment.production ? [] : AkitaNgDevtools,
    AkitaNgRouterStoreModule,
    AppRoutingModule,
    ComnSettingsModule.forRoot(),
    ComnAuthModule.forRoot(),
    AdminAppModule,
    ApiModule,
    CwdToolbarModule,
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatBottomSheetModule,
    MatExpansionModule,
    MatToolbarModule,
    ProjectModule,
    HttpClientModule,
    FlexLayoutModule,
    OverlayModule,
    HotkeysModule,
  ],
  providers: [
    {
      provide: BASE_PATH,
      useFactory: getBasePath,
      deps: [ComnSettingsService],
    },
    { provide: ErrorHandler, useClass: ErrorService },
    SystemMessageService,
  ],
  bootstrap: [AppComponent],
  entryComponents: [SystemMessageComponent],
})
export class AppModule {}
