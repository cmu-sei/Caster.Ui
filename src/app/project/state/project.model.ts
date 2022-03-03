// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

export enum ProjectObjectType {
  PROJECT = 'PROJECT',
  DIRECTORY = 'DIRECTORY',
  FILE = 'FILE',
  WORKSPACE = 'WORKSPACE',
  DESIGN = 'DESIGN',
}

export interface Breadcrumb {
  id: string;
  name: string;
  type: ProjectObjectType;
}

export interface Tab {
  id: string;
  type: ProjectObjectType;
  name: string;
  directoryId: string;
  breadcrumb: Array<Breadcrumb>;
}

export interface ProjectUI {
  id?: string;
  openTabs: Array<Tab>;
  selectedTab: number;
  rightSidebarOpen: boolean;
  rightSidebarView: string;
  rightSidebarWidth: number;
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
}
