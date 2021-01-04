// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityState,
  EntityStore,
  EntityUIStore,
  StoreConfig,
} from '@datorama/akita';
import { Workspace } from '../../generated/caster-api';
import { Injectable, InjectionToken } from '@angular/core';
import { WorkspaceEntityUi } from './workspace.model';

export interface WorkspaceState extends EntityState<Workspace> {
  lockingEnabled?: boolean;
}
export interface WorkspaceUIState extends EntityState<WorkspaceEntityUi> {}

export const initialWorkspaceEntityUiState: WorkspaceEntityUi = {
  isExpanded: false,
  expandedRuns: [],
  expandedResources: [],
  resourceActions: [],
  selectedRuns: [],
  statusFilter: [],
  workspaceView: 'runs',
};

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'workspaces' })
export class WorkspaceStore extends EntityStore<WorkspaceState, Workspace> {
  ui: EntityUIStore<WorkspaceUIState>;
  constructor() {
    super();
    this.createUIStore().setInitialEntityState((entity) => ({
      ...initialWorkspaceEntityUiState,
    }));
  }
}
