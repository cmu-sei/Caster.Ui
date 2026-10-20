// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  enableProdMode,
  provideZoneChangeDetection,
  ErrorHandler,
  importProvidersFrom,
} from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { environment } from './environments/environment';
import { enableAkitaProdMode, HashMap, persistState } from '@datorama/akita';
import { debounceTime } from 'rxjs/operators';
import {
  ResourceActions,
  WorkspaceEntityUi,
  WorkspaceUIState,
} from './app/workspace/state';
import { BASE_PATH, ApiModule } from './app/generated/caster-api';
import {
  ComnSettingsService,
  provideCrucibleTheme,
  ComnSettingsModule,
  ComnAuthModule,
  ComnHeaderBarModule,
} from '@cmusei/crucible-common';
import { ErrorService } from './app/sei-cwd-common/cwd-error/error.service';
import { SystemMessageService } from './app/sei-cwd-common/cwd-system-message/services/system-message.service';
import {
  MAT_TOOLTIP_DEFAULT_OPTIONS,
  MatTooltipDefaultOptions,
  MatTooltipModule,
} from '@angular/material/tooltip';
import {
  MAT_SNACK_BAR_DEFAULT_OPTIONS,
  MatSnackBarConfig,
} from '@angular/material/snack-bar';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import {
  PreloadAllModules,
  provideRouter,
  withPreloading,
  withRouterConfig,
} from '@angular/router';
import { routes } from './app/app.routes';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ProjectModule } from './app/project/project.module';
import { OverlayModule } from '@angular/cdk/overlay';
import { HotkeysModule } from '@ngneat/hotkeys';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { DesignModule } from './app/designs/design.module';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AppComponent } from './app/app.component';

// since the generated api code is a separate module we will set the BASE_PATH here at bootstrap.
export function getBasePath(settings: ComnSettingsService) {
  return settings.settings.ApiUrl;
}

/** Custom options to configure the tooltip's default show/hide delays. */
export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
  showDelay: 1000,
  hideDelay: 0,
  touchendHideDelay: 1000,
};

export const myCustomSnackBarDefaults: MatSnackBarConfig = {
  duration: 2000,
};

export const storage = persistState({
  key: 'akita-project-ui',
  include: [
    'UI/projects',
    'UI/files',
    'UI/directories',
    'UI/workspaces',
    'currentUser',
    'auth.ui',
  ],
  preStorageUpdate(storeName, state) {
    if (storeName === 'UI/workspaces') {
      // don't persist loading properties to avoid
      // them getting stuck in an incorrect state
      // TODO: look into select when we move to akita 5+
      const uiState = state as WorkspaceUIState;
      const keys = Object.keys(uiState.entities);
      const entities: HashMap<WorkspaceEntityUi> = {};

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const entity = { ...uiState.entities[key] };
        entity.resourceAction = ResourceActions.None;
        entity.resourceActions = [];
        entities[key] = entity;
      }

      const retVal: WorkspaceUIState = {
        entities: entities,
        error: uiState.error,
        ids: uiState.ids,
      };

      return retVal;
    }

    return state;
  },
  preStorageUpdateOperator: () => debounceTime(1000),
});

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    importProvidersFrom(
      BrowserModule,
      BrowserAnimationsModule,
      environment.production ? [] : AkitaNgDevtools.forRoot(),
      AkitaNgRouterStoreModule,
      ComnSettingsModule.forRoot(),
      ComnAuthModule.forRoot(),
      ApiModule,
      MatMenuModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatBottomSheetModule,
      MatExpansionModule,
      MatToolbarModule,
      ProjectModule,
      OverlayModule,
      HotkeysModule,
      MonacoEditorModule.forRoot(),
      DesignModule,
      MatCheckboxModule,
      ComnHeaderBarModule,
    ),
    {
      provide: BASE_PATH,
      useFactory: getBasePath,
      deps: [ComnSettingsService],
    },
    { provide: ErrorHandler, useClass: ErrorService },
    SystemMessageService,
    { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults },
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: myCustomSnackBarDefaults,
    },
    provideRouter(
      routes,
      withRouterConfig({
        paramsInheritanceStrategy: 'always',
        onSameUrlNavigation: 'reload',
      }),
      withPreloading(PreloadAllModules),
    ),
    provideHttpClient(withInterceptorsFromDi()),
    provideCrucibleTheme({ brand: { color: '#E9831C', text: '#FFFFFF' } }),
  ],
}).catch((err) => console.error(err));
