// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ProjectStore } from './project-store.service';
import { Injectable } from '@angular/core';
import { ProjectUI, Breadcrumb, ProjectObjectType, Tab } from './project.model';
import { DirectoryQuery } from 'src/app/directories';
import { ProjectQuery } from './project-query.service';
import {
  Workspace,
  Directory,
  Project,
  ProjectsService,
  ModelFile,
  ArchiveType,
  Design,
  VlansService,
} from 'src/app/generated/caster-api';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { WorkspaceQuery } from 'src/app/workspace/state';
import HttpHeaderUtils from 'src/app/shared/utilities/http-header-utils';
import { FileDownload } from 'src/app/shared/models/file-download';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  constructor(
    private projectStore: ProjectStore,
    private directoryQuery: DirectoryQuery,
    private workspaceQuery: WorkspaceQuery,
    private projectQuery: ProjectQuery,
    private projectsService: ProjectsService,
    private vlanService: VlansService
  ) {}

  loadProjects(onlyMine: boolean): Observable<Project[]> {
    return this.projectsService.getAllProjects(onlyMine).pipe(
      tap((projects) => {
        const projectUIs = this.projectQuery.ui.getAll();
        this.projectStore.set(projects);
        projects.forEach((project) => {
          const projectUI = projectUIs.find((pUI) => pUI.id === project.id);
          if (projectUI) {
            this.projectStore.ui.upsert(project.id, projectUI);
          }
        });
      })
    );
  }

  loadProject(projectId: string): Observable<Project> {
    console.log(projectId);
    return this.projectsService.getProject(projectId).pipe(
      tap((project) => {
        this.projectStore.upsert(project.id, project);
        this.projectStore.ui.upsert(
          project.id,
          this.projectQuery.ui.getEntity(project.id)
        );
      })
    );
  }

  createProject(project: Project): Observable<Project> {
    return this.projectsService.createProject(project).pipe(
      tap((ex) => {
        this.projectStore.add(ex);
        this.projectStore.ui.upsert(
          ex.id,
          this.projectQuery.ui.getEntity(ex.id)
        );
      })
    );
  }

  deleteProject(projectId: string): Observable<any> {
    return this.projectsService.deleteProject(projectId).pipe(
      tap(() => {
        this.projectStore.remove(projectId);
        this.projectStore.ui.remove(projectId);
      })
    );
  }

  updateProject(project: Project): Observable<Project> {
    return this.projectsService.editProject(project.id, project).pipe(
      tap((project) => {
        this.projectStore.upsert(project.id, project);
        this.projectStore.ui.upsert(
          project.id,
          this.projectQuery.ui.getEntity(project.id)
        );
      })
    );
  }

  setSelectedTab(index: number) {
    const project = this.projectQuery.getActive();
    if (project) {
      let exUi = this.projectQuery.ui.getEntity(project.id);
      exUi = { ...exUi, selectedTab: index } as ProjectUI;
      this.projectStore.ui.upsert(exUi.id, exUi);
    }
  }

  closeTab(id: string) {
    const project = this.projectQuery.getActive();
    if (project) {
      const projectUI = this.projectQuery.ui.getEntity(project.id);
      const tabs = new Array<Tab>().concat(projectUI.openTabs);
      const index = projectUI.openTabs.findIndex((e) => e.id === id);
      tabs.splice(index, 1);
      const selected =
        projectUI.selectedTab >= tabs.length
          ? tabs.length - 1
          : projectUI.selectedTab;
      const exUi = { ...projectUI, openTabs: tabs, selectedTab: selected };
      this.projectStore.ui.upsert(exUi.id, exUi);
    }
  }

  openTab(obj: ModelFile | Workspace | Design, objType: ProjectObjectType) {
    const project = this.projectQuery.getActive();
    if (project) {
      const projectUI = this.projectQuery.ui.getEntity(project.id);
      const tabIndex = projectUI.openTabs.findIndex((t) => t.id === obj.id);
      if (tabIndex > -1) {
        // Tab already open so simply select it
        if (projectUI.selectedTab !== tabIndex) {
          const exUi = { ...projectUI, selectedTab: tabIndex } as ProjectUI;
          this.projectStore.ui.upsert(exUi.id, exUi);
        }
      } else {
        // Tab is not open, add it
        let tabs = new Array<Tab>();
        tabs = tabs.concat(projectUI.openTabs);
        tabs.push({
          id: obj.id,
          name: obj.name,
          type: objType,
          directoryId: obj.directoryId,
        } as Tab);
        const exUi = {
          ...projectUI,
          openTabs: tabs,
          selectedTab: tabs.length - 1,
        } as ProjectUI;
        this.projectStore.ui.upsert(exUi.id, exUi);
      }
    }
  }

  updateTabBreadcrumb(tabId: string, newBreadcrumb: Breadcrumb[]) {
    const project = this.projectQuery.getActive();
    let isChanged = false;
    if (project) {
      const projectUI = this.projectQuery.ui.getEntity(project.id);
      let updatedTabs = new Array<Tab>();
      projectUI.openTabs.forEach((tab) => {
        if (tab.id === tabId) {
          if (!tab.breadcrumb) {
            isChanged = true;
          } else if (newBreadcrumb.length === tab.breadcrumb.length) {
            for (let i = 0; i < newBreadcrumb.length; i++) {
              if (
                newBreadcrumb[i].id !== tab.breadcrumb[i].id ||
                newBreadcrumb[i].name !== tab.breadcrumb[i].name ||
                newBreadcrumb[i].type !== tab.breadcrumb[i].type
              ) {
                isChanged = true;
              }
            }
          }
          if (isChanged) {
            const newTab = {
              id: tab.id,
              name: tab.name,
              type: tab.type,
              directoryId: tab.directoryId,
              breadcrumb: newBreadcrumb,
            };
            updatedTabs.push(newTab);
          }
        } else {
          updatedTabs.push(tab);
        }
      });
      if (isChanged) {
        const exUi = { ...projectUI, openTabs: updatedTabs } as ProjectUI;
        this.projectStore.ui.upsert(exUi.id, exUi);
      }
    }
  }

  createBreadcrumb(
    project: Project,
    obj: ModelFile | Workspace | Design | Tab,
    objType: ProjectObjectType
  ): Array<Breadcrumb> {
    const breadcrumb: Breadcrumb[] = [];
    breadcrumb.push({
      name: obj.name,
      id: obj.id,
      type: objType,
    } as Breadcrumb);
    if (
      objType === ProjectObjectType.FILE &&
      (obj as ModelFile).workspaceId !== null
    ) {
      // When the file belongs to a workspace, add the workspace to the breadcrumb
      const workspace = this.workspaceQuery.getEntity(
        (obj as ModelFile).workspaceId
      );
      if (workspace) {
        breadcrumb.unshift({
          name: workspace.name,
          id: workspace.id,
          type: ProjectObjectType.WORKSPACE,
        } as Breadcrumb);
      }
    }

    let currentDir: Directory = this.directoryQuery.getEntity(obj.directoryId);
    while (currentDir) {
      breadcrumb.unshift({
        name: currentDir.name,
        id: currentDir.id,
        type: ProjectObjectType.DIRECTORY,
      } as Breadcrumb);
      currentDir = this.directoryQuery.getEntity(currentDir.parentId);
    }
    breadcrumb.unshift({
      name: project.name,
      id: project.id,
      type: ProjectObjectType.PROJECT,
    } as Breadcrumb);

    return breadcrumb;
  }

  setRightSidebarOpen(projectId: string, open: boolean) {
    this.projectStore.ui.upsert(projectId, { rightSidebarOpen: open });
  }

  setRightSidebarView(projectId: string, view: string) {
    this.projectStore.ui.upsert(projectId, { rightSidebarView: view });
  }

  setRightSidebarWidth(projectId: string, width: number) {
    this.projectStore.ui.upsert(projectId, { rightSidebarWidth: width });
  }

  setLeftSidebarOpen(projectId: string, open: boolean) {
    this.projectStore.ui.upsert(projectId, { leftSidebarOpen: open });
  }

  setLeftSidebarWidth(projectId: string, width: number) {
    this.projectStore.ui.upsert(projectId, { leftSidebarWidth: width });
  }

  export(
    id: string,
    archiveType: ArchiveType,
    includeIds: boolean
  ): Observable<FileDownload> {
    return this.projectsService
      .exportProject(id, archiveType, includeIds, 'response')
      .pipe(
        map((response) => {
          return {
            blob: response.body,
            filename: HttpHeaderUtils.getFilename(response.headers),
          };
        })
      );
  }

  assignPartition(projectId: string, partitionId: string) {
    let obs: Observable<Project>;

    if (partitionId) {
      obs = this.vlanService.assignPartition(partitionId, {
        projectId: projectId,
      });
    } else {
      obs = this.vlanService.unassignPartition({
        projectId: projectId,
      });
    }

    return obs.pipe(
      tap((project) => this.projectStore.upsert(project.id, project))
    );
  }
}
