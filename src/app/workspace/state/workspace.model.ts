// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Resource, Run, Workspace } from '../../generated/caster-api';

export function createRun({
  id,
  workspaceId,
  createdAt,
  isDestroy,
  status,
  plan,
  apply,
}: Partial<Run>) {
  return {
    id: id || null,
    workspaceId,
    createdAt,
    isDestroy,
    status,
    planId: plan == null ? null : plan.id,
    applyId: apply == null ? null : apply.id,
    plan: plan || {},
    apply: apply || {},
  };
}

export interface StatusFilter {
  key: string;
  filter: boolean;
}

// Use declaration merging to extend the workspace model for the Entity state.
declare module 'src/app/generated/caster-api/model/workspace' {
  interface Workspace {
    runs: Run[];
    resources?: Resource[];
  }
}

export interface WorkspaceEntityUi {
  id?: string;
  isExpanded: boolean;
  expandedRuns: string[];
  expandedResources: string[];
  resourceActions: string[];
  selectedRuns: string[];
  statusFilter: StatusFilter[];
  workspaceView: string;
}

export function createWorkspace({
  id,
  name,
  directoryId,
  runs,
  dynamicHost,
  resources,
}: Partial<Workspace>) {
  return {
    id: id || null,
    name,
    directoryId,
    dynamicHost: dynamicHost || false,
    runs: runs || [],
    resources: resources || [],
  } as Workspace;
}
