// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityState,
  EntityStore,
  EntityUIStore,
  StoreConfig,
} from '@datorama/akita';
import { Module } from '../../generated/caster-api';
import { Injectable, InjectionToken } from '@angular/core';
import { ModuleUi } from './module.model';

export interface ModulesState extends EntityState<Module> {}
export interface ModuleUIState extends EntityState<ModuleUi> {}

export const initialModuleUiState: ModuleUi = {
  isSelected: false,
  isEditing: false,
  isSaved: false,
};

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'modules' })
export class ModuleStore extends EntityStore<ModulesState> {
  ui: EntityUIStore<ModuleUIState>;
  constructor() {
    super();
    this.createUIStore().setInitialEntityState((entity) => ({
      ...initialModuleUiState,
    }));
  }
}
