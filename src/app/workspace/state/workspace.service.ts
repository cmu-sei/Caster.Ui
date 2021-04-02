// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import {
  arrayRemove,
  arrayToggle,
  arrayUpsert,
  coerceArray,
} from '@datorama/akita';
import { Observable, of } from 'rxjs';
import { concatMap, take, tap } from 'rxjs/operators';
import { FileService } from 'src/app/files/state';
import {
  AppliesService,
  ImportResourceCommand,
  PlansService,
  Resource,
  ResourceCommandResult,
  ResourcesService,
  Run,
  RunsService,
  RunStatus,
  Workspace,
  WorkspacesService,
} from '../../generated/caster-api';
import { isUpdate } from '../../shared/utilities/functions';
import {
  ResourceActions,
  StatusFilter,
  WorkspaceEntityUi,
} from './workspace.model';
import { WorkspaceQuery } from './workspace.query';
import { WorkspaceStore } from './workspace.store';
@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  constructor(
    private workspaceStore: WorkspaceStore,
    private workspacesService: WorkspacesService,
    private workspaceQuery: WorkspaceQuery,
    private fileService: FileService,
    private runsService: RunsService,
    private appliesService: AppliesService,
    private plansService: PlansService,
    private resourceService: ResourcesService
  ) {}

  getWorkspace(workspaceId: string) {
    this.workspacesService.getWorkspace(workspaceId).subscribe((workspace) => {
      let ws = this.workspaceQuery.getEntity(workspace.id);
      if (ws) {
        ws = { ...ws, name: ws.name };
        this.workspaceStore.update(ws.id, ws);
      } else {
        const newWorkspace = {
          ...workspace,
          runs: new Array<Run>(),
        } as Workspace;
        this.workspaceStore.add(newWorkspace);
      }
    });
  }

  setWorkspaces(workspaces: Workspace[]) {
    const workspaceUIs = this.workspaceQuery.ui.getAll();
    this.workspaceStore.set(workspaces);
    workspaces.forEach((w) => {
      const workspaceUI = workspaceUIs.find((wUI) => wUI.id === w.id);
      if (workspaceUI) {
        this.workspaceStore.ui.upsert(workspaceUI.id, workspaceUI);
      }
    });
  }

  add(workspace: Workspace) {
    this.workspacesService.createWorkspace(workspace).subscribe((w) => {
      this.workspaceStore.add(w);
      this.fileService
        .loadFilesByDirectory(w.directoryId)
        .pipe(take(1))
        .subscribe();
    });
  }

  update(workspace: Workspace) {
    this.workspacesService
      .partialEditWorkspace(workspace.id, { ...workspace } as Workspace)
      .subscribe((w) => {
        this.workspaceStore.update(w.id, w);
      });
  }

  partialUpdate(id: string, workspace: Partial<Workspace>) {
    this.workspacesService
      .partialEditWorkspace(id, { ...workspace } as Workspace)
      .subscribe((w) => {
        this.workspaceStore.update(w.id, w);
      });
  }

  updated(workspace: Workspace) {
    this.workspaceStore.upsert(workspace.id, workspace);
  }

  delete(workspace: Workspace) {
    this.workspacesService.deleteWorkspace(workspace.id).subscribe(() => {
      this.deleted(workspace.id);
    });
  }

  deleted(workspaceId: string) {
    this.workspaceStore.remove(workspaceId);
  }

  runUpdated(run: Run) {
    const workspace: Workspace = { id: run.workspaceId, runs: [] };
    this.workspaceStore.add(workspace);

    this.workspaceStore.update(run.workspaceId, (entity) => ({
      runs: arrayUpsert(entity.runs, run.id, { ...run }),
    }));
  }

  planOutputUpdated(workspaceId: string, runId: string, output: string) {
    this.workspaceStore.update(workspaceId, (entity) => ({
      runs: arrayUpsert(entity.runs, runId, { plan: { output } }),
    }));
  }

  applyOutputUpdated(workspaceId: string, runId: string, output: string) {
    this.workspaceStore.update(workspaceId, (entity) => ({
      runs: arrayUpsert(entity.runs, runId, { apply: { output } }),
    }));
  }

  taint(workspaceId: string, items: Resource | Resource[]) {
    const resourceAddresses = this.startResourceAction(
      workspaceId,
      items,
      ResourceActions.Taint
    );

    return this.resourceService
      .taintResources(workspaceId, { resourceAddresses })
      .pipe(
        tap((result: ResourceCommandResult) => {
          this.finishResourceAction(workspaceId, result);
        })
      );
  }

  untaint(workspaceId: string, items: Resource | Resource[]) {
    const resourceAddresses = this.startResourceAction(
      workspaceId,
      items,
      ResourceActions.Taint
    );

    return this.resourceService
      .untaintResources(workspaceId, { resourceAddresses })
      .pipe(
        tap((result: ResourceCommandResult) => {
          this.finishResourceAction(workspaceId, result);
        })
      );
  }

  remove(workspaceId: string, items: Resource | Resource[]) {
    const resourceAddresses = this.startResourceAction(
      workspaceId,
      items,
      ResourceActions.Remove
    );

    return this.resourceService
      .removeResources(workspaceId, { resourceAddresses })
      .pipe(
        tap((result: ResourceCommandResult) => {
          this.finishResourceAction(workspaceId, result);
        })
      );
  }

  import(workspaceId: string, command: ImportResourceCommand) {
    this.workspaceStore.setLoading(true);
    return this.resourceService.importResources(workspaceId, command).pipe(
      tap((result: ResourceCommandResult) => {
        this.workspaceStore.update(workspaceId, () => ({
          resources: result.resources,
        }));

        this.workspaceStore.setLoading(false);
      })
    );
  }

  setActive(workspace: Workspace | null) {
    // if id is null or undefined, a file or folder is active
    if (!workspace) {
      this.workspaceStore.setActive(null);
      return;
    }
    this.workspaceStore.setActive(workspace.id);
  }

  setStatusFilters(workspaceId: string, statusFilters?: StatusFilter[]) {
    if (statusFilters && statusFilters.length > 0) {
      this.workspaceStore.ui.update(workspaceId, (entity) => ({
        statusFilter: statusFilters,
      }));
    } else {
      // Filters are saved in persistent storage if they exist we will load them instead of the defaults
      const persistedStatusFilters = this.workspaceQuery.ui.getValue()
        .statusFilter;

      if (persistedStatusFilters && persistedStatusFilters.length > 0) {
        this.workspaceStore.ui.update(workspaceId, (state) => ({
          statusFilter: persistedStatusFilters,
        }));
      } else {
        const defaultStatusFilters = Object.keys(RunStatus).map((o) => ({
          key: o,
          filter: false,
        }));
        this.workspaceStore.ui.update(workspaceId, (state) => ({
          statusFilter: defaultStatusFilters,
        }));
      }
    }
  }

  createPlanRun(workspaceId: string, isDestroy: boolean) {
    return this.workspaceQuery
      .selectEntity(workspaceId, (entity) => entity.id)
      .pipe(
        concatMap((_id: string) =>
          this.runsService.createRun({ workspaceId: _id, isDestroy })
        ),
        tap((run) => this.expandRun(true, run))
      );
  }

  applyRun(workspaceId: string, id: string) {
    return this.appliesService
      .applyRun(id)
      .pipe(tap((run) => this.expandRun(true, run)));
  }

  rejectRun(workspaceId, runId: string) {
    return this.runsService.rejectRun(runId);
  }

  saveState(runId: string) {
    this.workspaceStore.setLoading(true);
    return this.runsService
      .saveState(runId)
      .pipe(tap((run) => this.workspaceStore.setLoading(false)));
  }

  selectRun(workspaceId, runId) {
    this._setSelectedRun(workspaceId, runId);
  }

  private _setSelectedRun(workspaceId: string, runId: string) {
    this.workspaceStore.ui.update(workspaceId, (entity) => ({
      selectedRuns: [runId],
    }));
  }

  loadRunsByWorkspaceId(id: string): Observable<any> {
    return of(id).pipe(
      tap(() => {
        this.workspaceStore.setLoading(true);
      }),
      concatMap((_id) =>
        this.runsService.getRunsByWorkspaceId(_id, null, false, false)
      ),
      tap((runs) => {
        this.workspaceStore.update(id, (entity) => ({
          runs,
        }));
      }),
      tap(() => {
        this.workspaceStore.setLoading(false);
      })
    );
  }

  loadAllActiveRuns(): void {
    this.workspaceStore.setLoading(true);

    this.runsService
      .getRuns(true)
      .pipe(
        tap((runs) => {
          const uniqueWorkspaceids = runs
            .map((r) => r.workspaceId)
            .filter((v, i, a) => a.indexOf(v) === i);

          uniqueWorkspaceids.forEach((x) => {
            const workspace: Workspace = { id: x, runs: [] };
            this.workspaceStore.add(workspace);
          });

          runs.forEach((r) => this.runUpdated(r));
          this.workspaceStore.setLoading(false);
        }),
        take(1)
      )
      .subscribe();
  }

  loadResourcesByWorkspaceId(id: string): Observable<any> {
    return of(id).pipe(
      tap(() => {
        this.workspaceStore.setLoading(true);
      }),
      concatMap((_id) => this.resourceService.getResourcesByWorkspace(_id)),
      tap((resources) => {
        this.workspaceStore.update(id, (entity) => ({
          resources,
        }));
      }),
      tap(() => {
        this.workspaceStore.setLoading(false);
      })
    );
  }

  updateResource(workspaceId: string, item: Resource): void {
    this.resourceService
      .getResource(workspaceId, item.id, item.type)
      .pipe(
        tap((resource) =>
          this.workspaceStore.update(workspaceId, (entity) => ({
            resources: arrayUpsert(entity.resources, item.id, resource),
          }))
        ),
        take(1)
      )
      .subscribe();
  }

  refreshResources(workspaceId: string) {
    this.workspaceStore.setLoading(true);
    return this.resourceService.refreshResources(workspaceId).pipe(
      tap((result: ResourceCommandResult) =>
        this.workspaceStore.update(workspaceId, (entity) => ({
          resources: result.resources,
        }))
      ),
      tap(() => this.workspaceStore.setLoading(false))
    );
  }

  expandRun(expand, run) {
    this.workspaceStore.ui.upsert(
      run.workspaceId,
      (workspace: WorkspaceEntityUi) => {
        const exists = workspace.expandedRuns.includes(run.id);
        if (!exists && expand) {
          return {
            expandedRuns: arrayUpsert(workspace.expandedRuns, run.id, run.id),
          };
        } else if (exists && !expand) {
          return { expandedRuns: arrayRemove(workspace.expandedRuns, run.id) };
        }
        // No Change
        return { expandedRuns: workspace.expandedRuns };
      }
    );
  }

  startResourceAction(
    workspaceId: string,
    items: Resource | Resource[],
    action: ResourceActions
  ): string[] {
    const itemsArray = coerceArray(items);

    this.workspaceStore.ui.upsert(workspaceId, () => ({
      resourceActions: itemsArray.map((i) => i.id),
      resourceAction: action,
    }));

    return itemsArray.map((i) => i.address);
  }

  finishResourceAction(workspaceId: string, result: ResourceCommandResult) {
    this.workspaceStore.upsert(workspaceId, () => ({
      resources: result.resources,
    }));

    this.workspaceStore.ui.upsert(workspaceId, () => ({
      resourceActions: [],
      resourceAction: ResourceActions.None,
    }));
  }

  expandResource(expand, workspaceId, resource) {
    this.workspaceStore.ui.upsert(workspaceId, (w) => ({
      expandedResources: isUpdate<WorkspaceEntityUi>(w)
        ? arrayToggle(w.expandedResources, resource.id)
        : undefined,
    }));
  }

  toggleIsExpanded(workspaceId: string) {
    this.workspaceStore.ui.upsert(
      workspaceId,
      (entity) => {
        const ent = this.workspaceQuery.ui.getEntity(workspaceId);
        return { ...ent, isExpanded: !ent.isExpanded };
      },
      (id, w) => ({ id, ...w, isExpanded: !w.isExpanded })
    );
  }

  isExpanded(workspaceId: string) {
    return this.workspaceQuery.ui.getEntity(workspaceId).isExpanded;
  }

  setWorkspaceView(id: string, view: string) {
    this.workspaceStore.ui.upsert(id, { workspaceView: view });
  }

  loadLockingStatus() {
    this.workspacesService
      .getWorkspaceLockingStatus()
      .pipe(take(1))
      .subscribe((lockingStatus) => {
        this.workspaceStore.update({ lockingEnabled: lockingStatus });
      });
  }

  setLockingEnabled(status: boolean) {
    let result: Observable<boolean>;

    if (status) {
      result = this.workspacesService.enableWorkspaceLocking();
    } else {
      result = this.workspacesService.disableWorkspaceLocking();
    }

    result.pipe(take(1)).subscribe((lockingStatus) => {
      this.lockingEnabledUpdated(lockingStatus);
    });
  }

  lockingEnabledUpdated(status: boolean) {
    this.workspaceStore.update({ lockingEnabled: status });
  }
}
