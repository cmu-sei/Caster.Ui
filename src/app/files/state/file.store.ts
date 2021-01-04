// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityState,
  EntityStore,
  StoreConfig,
  ActiveState,
  EntityUIStore,
} from '@datorama/akita';
import { Injectable } from '@angular/core';
import { ModelFile } from '../../generated/caster-api';
import { FileUI } from 'src/app/files/state/file.model';

export interface FileUIState extends EntityState<FileUI>, ActiveState {}
export interface FileState extends EntityState<ModelFile>, ActiveState {}

export const initialFileUIState: FileUI = {
  isSaved: true,
  selectedVersionId: '',
};

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'files' })
export class FileStore extends EntityStore<FileState> {
  ui: EntityUIStore<FileUIState>;
  constructor() {
    super();
    this.createUIStore().setInitialEntityState((entity) => ({
      ...initialFileUIState,
    }));
  }
}
