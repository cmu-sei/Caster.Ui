// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  arrayFind,
  EntityUIQuery,
  ID,
  Order,
  QueryConfig,
  QueryEntity,
} from '@datorama/akita';
import {
  WorkspaceState,
  WorkspaceStore,
  WorkspaceUIState,
} from './workspace.store';
import {
  Resource,
  Run,
  Workspace,
  RunStatus,
} from '../../generated/caster-api';
import { Injectable } from '@angular/core';
import {
  ResourceActions,
  StatusFilter,
  WorkspaceEntityUi,
} from './workspace.model';
import { combineLatest, Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({
  providedIn: 'root',
})
export class WorkspaceQuery extends QueryEntity<WorkspaceState, Workspace> {
  ui: EntityUIQuery<WorkspaceUIState, WorkspaceEntityUi>;

  constructor(protected store: WorkspaceStore) {
    super(store);
    this.createUIQuery();
  }

  workspaceRuns$(id): Observable<Run[]> {
    return combineLatest([
      this.selectEntity(id, (entity) => entity.runs),
      this.filters$(id),
    ]).pipe(
      map(([runs, filters]) => {
        if (runs && runs.length > 0) {
          // Runs is immutable so we have to convert it or the sort function wont work.
          const tmpRuns = JSON.parse(JSON.stringify(runs));
          // Sort by most recent
          tmpRuns.sort((a, b) => {
            // Convert to UTC epoch
            return Date.parse(b.createdAt) - Date.parse(a.createdAt);
          });

          if (filters) {
            const filtersReduced = filters
              .filter((f) => f.filter === true)
              .map((i) => i.key);
            if (filtersReduced && filtersReduced.length < 1) {
              return tmpRuns;
            } else {
              return tmpRuns.filter(
                (run) => !filtersReduced.includes(run.status)
              );
            }
          } else {
            return tmpRuns;
          }
        }
      })
    );
  }

  workspaceResources$(id): Observable<Resource[]> {
    return this.selectEntity(id, (entity) => entity.resources);
  }

  selectedRuns$(workspaceId): Observable<string[]> {
    return this.ui.selectEntity(workspaceId, (entity) => entity.selectedRuns);
  }

  expandedRuns$(workspaceId?): Observable<string[]> {
    if (workspaceId != null) {
      return this.ui.selectEntity(workspaceId, (entity) => entity.expandedRuns);
    } else {
      return this.ui.selectAll().pipe(
        map((w) => w.map((x) => x.expandedRuns)),
        map((r) => [].concat(...r))
      );
    }
  }

  resourceActions$(workspaceId): Observable<string[]> {
    return this.ui.selectEntity(
      workspaceId,
      (entity) => entity.resourceActions
    );
  }

  resourceAction$(workspaceId): Observable<ResourceActions> {
    return this.ui.selectEntity(workspaceId, (entity) => entity.resourceAction);
  }

  expandedResources$(workspaceId: string): Observable<string[]> {
    return this.ui.selectEntity(
      workspaceId,
      (entity) => entity.expandedResources
    );
  }

  filters$(workspaceId): Observable<StatusFilter[]> {
    return this.ui.selectEntity(workspaceId, (entity) => entity.statusFilter);
  }

  selectRunById$(workspace, runId): Observable<Run> {
    return this.selectEntity(workspace, 'runs').pipe(
      map((runs) => runs.find((r) => r.id === runId))
    );
  }

  selectResourceById$(workspaceId, resourceId) {
    return this.selectEntity(workspaceId, 'resources').pipe(
      arrayFind(resourceId),
      shareReplay(1)
    );
  }

  activeRuns$(): Observable<Run[]> {
    const activeStatuses = [
      RunStatus.Queued,
      RunStatus.Planning,
      RunStatus.Applying,
    ];

    return this.selectAll().pipe(
      map((w) =>
        w.map((x) => x.runs.filter((r) => activeStatuses.includes(r.status)))
      ),
      map((r) => [].concat(...r))
    );
  }

  getWorkspaceView(workspaceId): Observable<string> {
    return this.ui.selectEntity(workspaceId, (entity) => entity.workspaceView);
  }

  getOrSelectEntity(id: ID): Observable<Workspace> {
    const entity = this.getEntity(id);
    if (entity) {
      return of(entity);
    }
    return this.selectEntity(id);
  }
}
