// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityState,
  EntityStore,
  EntityUIStore,
  StoreConfig,
} from '@datorama/akita';
import { FileVersion } from '../../generated/caster-api';
import { Injectable, InjectionToken } from '@angular/core';
import { FileVersionUi } from './fileVersion.model';

export interface FileVersionsState extends EntityState<FileVersion> {}
export interface FileVersionUIState extends EntityState<FileVersionUi> {}

export const initialFileVersionUiState: FileVersionUi = {
  isSelected: false,
};

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'fileVersions' })
export class FileVersionStore extends EntityStore<FileVersionsState> {
  ui: EntityUIStore<FileVersionUIState>;
  constructor() {
    super();
    this.createUIStore().setInitialEntityState((entity) => ({
      ...initialFileVersionUiState,
    }));
  }
}
