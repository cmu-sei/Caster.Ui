// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { QueryEntity, EntityUIQuery } from '@datorama/akita';
import {
  ProjectStore,
  ProjectState,
  ProjectUIState,
} from './project-store.service';
import { Breadcrumb, Tab } from './project.model';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { Project } from 'src/app/generated/caster-api';

@Injectable({
  providedIn: 'root',
})
export class ProjectQuery extends QueryEntity<ProjectState, Project> {
  ui: EntityUIQuery<ProjectUIState>;

  constructor(protected store: ProjectStore) {
    super(store);
    this.createUIQuery();
  }

  getRightSidebarOpen$(projectId): Observable<boolean> {
    return this.ui.selectEntity(projectId, (entity) => entity.rightSidebarOpen);
  }

  getRightSidebarView$(projectId): Observable<string> {
    return this.ui.selectEntity(projectId, (entity) => entity.rightSidebarView);
  }

  getRightSidebarWidth(projectId): Observable<number> {
    return this.ui.selectEntity(
      projectId,
      (entity) => entity.rightSidebarWidth
    );
  }

  getLeftSidebarOpen(projectId): Observable<boolean> {
    return this.ui.selectEntity(projectId, (entity) => entity.leftSidebarOpen);
  }

  getLeftSidebarWidth(projectId): Observable<number> {
    return this.ui.selectEntity(projectId, (entity) => entity.leftSidebarWidth);
  }

  selectTabBreadcrumb(
    projectId: string,
    tabId: string
  ): Observable<Breadcrumb[]> {
    return this.ui.selectEntity(projectId, (entity) => {
      const tab = entity.openTabs.find((t) => t.id === tabId);
      return tab ? tab.breadcrumb : [];
    });
  }

  selectOpenTabs(projectId: string): Observable<Tab[]> {
    return this.ui.selectEntity(projectId, (entity) => entity.openTabs);
  }

  selectSelectedTab(projectId: string): Observable<number> {
    return this.ui.selectEntity(projectId, (entity) => entity.selectedTab);
  }

  selectBreadcrumb(
    projectId: string,
    entityId: string
  ): Observable<Breadcrumb[]> {
    return this.ui.selectEntity(
      projectId,
      (entity) => entity.openTabs.find((t) => t.id === entityId).breadcrumb
    );
  }
}
