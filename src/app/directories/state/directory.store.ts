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
import { DirectoryUI } from './directory.model';
import { Directory } from 'src/app/generated/caster-api';

export interface DirectoryUIState
  extends EntityState<DirectoryUI>,
    ActiveState {}
export interface DirectoryState extends EntityState<Directory>, ActiveState {}

export const initialDirectoryUIState: DirectoryUI = {
  isExpanded: false,
  isFilesExpanded: false,
  isWorkspacesExpanded: false,
  isDirectoriesExpanded: false,
};

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'directories' })
export class DirectoryStore extends EntityStore<DirectoryState> {
  ui: EntityUIStore<DirectoryUIState>;
  constructor() {
    super();
    this.createUIStore().setInitialEntityState((entity) => ({
      ...initialDirectoryUIState,
    }));
  }
}
