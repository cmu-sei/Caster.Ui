// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import {
  akitaDevtools,
  enableAkitaProdMode,
  HashMap,
  persistState,
} from '@datorama/akita';
import { debounceTime } from 'rxjs/operators';
import {
  ResourceActions,
  WorkspaceEntityUi,
  WorkspaceUIState,
} from './app/workspace/state';

export const storage = persistState({
  key: 'akita-project-ui',
  include: [
    'UI/projects',
    'UI/files',
    'UI/directories',
    'UI/workspaces',
    'currentUser',
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

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
