// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityState,
  EntityStore,
  EntityUIStore,
  StoreConfig,
  ActiveState,
} from '@datorama/akita';
import { ProjectUI } from './project.model';
import { Injectable } from '@angular/core';
import { Project } from 'src/app/generated/caster-api';

export interface ProjectUIState extends EntityState<ProjectUI>, ActiveState {}
export interface ProjectState extends EntityState<Project>, ActiveState {}

export const initialProjectUIState: ProjectUI = {
  openTabs: [],
  selectedTab: null,
  rightSidebarOpen: false,
  rightSidebarView: '',
  rightSidebarWidth: 300,
  leftSidebarOpen: true,
  leftSidebarWidth: 364,
};

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'projects' })
export class ProjectStore extends EntityStore<ProjectState> {
  ui: EntityUIStore<ProjectUIState>;
  constructor() {
    super();
    this.createUIStore().setInitialEntityState((entity) => ({
      ...initialProjectUIState,
    }));
  }
}
