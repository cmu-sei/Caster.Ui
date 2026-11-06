// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkspaceService, WorkspaceQuery } from 'src/app/workspace/state';
import { EMPTY, Observable, Subject, of } from 'rxjs';
import {
  catchError,
  finalize,
  map,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';
import {
  DirectoriesService,
  ProjectsService,
  Run,
  SystemPermission,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { MatIcon } from '@angular/material/icon';
import { LockingStatusComponent } from './locking-status/locking-status.component';
import {
  ActiveRunsComponent,
  RunWorkspace,
} from './active-runs/active-runs.component';
import { AsyncPipe } from '@angular/common';

const SNACK_BAR = {
  duration: 5000,
  verticalPosition: 'top',
  horizontalPosition: 'center',
} as const;

/** The API's own reason when it gave one, otherwise the fallback. */
function reason(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    return error.error?.title || fallback;
  }
  return fallback;
}

@Component({
  selector: 'cas-admin-workspaces',
  templateUrl: './admin-workspaces.component.html',
  styleUrls: ['./admin-workspaces.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIcon, LockingStatusComponent, ActiveRunsComponent, AsyncPipe],
})
export class AdminWorkspacesComponent implements OnInit, OnDestroy {
  private workspaceService = inject(WorkspaceService);
  private workspaceQuery = inject(WorkspaceQuery);
  private signalRService = inject(SignalRService);
  private snackBar = inject(MatSnackBar);
  private permissionService = inject(PermissionService);
  private workspacesApi = inject(WorkspacesService);
  private directoriesApi = inject(DirectoriesService);
  private projectsApi = inject(ProjectsService);
  private unsubscribe$ = new Subject<void>();

  public lockingEnabled$: Observable<boolean>;
  public activeRuns$: Observable<Run[]>;
  public expandedRuns$: Observable<string[]>;
  /** Turning Workspace operations on or off needs ManageWorkspaces, as in the API. */
  public canManage$ = this.permissionService.hasPermission(
    SystemPermission.ManageWorkspaces,
  );
  readonly changingLocking = signal(false);
  readonly loading = signal(true);
  /** Each active run's Workspace by Workspace ID; null if the viewer can't read it. */
  readonly workspaces = signal<Record<string, RunWorkspace | null>>({});
  private lookedUp = new Set<string>();

  ngOnInit() {
    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinWorkspacesAdmin();
      })
      .catch((err) => {
        console.log(err);
      });

    this.lockingEnabled$ = this.workspaceQuery.select(
      (state) => state.lockingEnabled,
    );
    this.workspaceService
      .loadLockingStatus()
      .pipe(
        catchError((error) => {
          this.notify(
            reason(
              error,
              "Couldn't read whether Workspace operations are disabled",
            ),
          );
          return EMPTY;
        }),
      )
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe();

    this.workspaceService
      .loadAllActiveRuns()
      .pipe(
        catchError((error) => {
          this.notify(reason(error, "Couldn't load the active runs"));
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      )
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe();
    this.activeRuns$ = this.workspaceQuery.activeRuns$();
    this.expandedRuns$ = this.workspaceQuery.expandedRuns$();

    // Name each run's Workspace and Project, also for runs the hub adds later.
    this.activeRuns$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((runs) => runs.forEach((r) => this.lookUp(r.workspaceId)));
  }

  /**
   * Read a Workspace's name, then its directory's Project for the Project name
   * and the link. Each step needs only what the viewer may already read.
   */
  private lookUp(workspaceId: string) {
    if (!workspaceId || this.lookedUp.has(workspaceId)) {
      return;
    }
    this.lookedUp.add(workspaceId);
    this.workspacesApi
      .getWorkspace(workspaceId)
      .pipe(
        switchMap((workspace) =>
          this.directoriesApi.getDirectory(workspace.directoryId).pipe(
            switchMap((directory) =>
              this.projectsApi.getProject(directory.projectId).pipe(
                map((project) => project.name),
                catchError(() => of(null)),
                map(
                  (projectName): RunWorkspace => ({
                    name: workspace.name,
                    projectId: directory.projectId,
                    projectName,
                  }),
                ),
              ),
            ),
            catchError(() =>
              of<RunWorkspace>({
                name: workspace.name,
                projectId: null,
                projectName: null,
              }),
            ),
          ),
        ),
        // A Workspace the viewer can't read: the table says so.
        catchError(() => of(null)),
        take(1),
        takeUntil(this.unsubscribe$),
      )
      .subscribe((info) =>
        this.workspaces.update((all) => ({ ...all, [workspaceId]: info })),
      );
  }

  setLockingEnabled(status: boolean) {
    this.changingLocking.set(true);
    this.workspaceService
      .setLockingEnabled(status)
      .pipe(
        catchError((error) => {
          this.notify(
            reason(
              error,
              status
                ? "Couldn't enable Workspace operations"
                : "Couldn't disable Workspace operations",
            ),
          );
          return EMPTY;
        }),
        finalize(() => this.changingLocking.set(false)),
      )
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe((enabled) =>
        this.notify(
          enabled
            ? 'Workspace operations are enabled'
            : 'Workspace operations are disabled until you enable them or the Caster API restarts',
        ),
      );
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Dismiss', SNACK_BAR);
  }

  expandRun(event: { expand: boolean; item: Run }) {
    this.workspaceService.expandRun(event.expand, event.item);
  }

  planOutput(event: { output: string; item: Run }) {
    this.workspaceService.planOutputUpdated(
      event.item.workspaceId,
      event.item.id,
      event.output,
    );
  }

  applyOutput(event: { output: string; item: Run }) {
    this.workspaceService.applyOutputUpdated(
      event.item.workspaceId,
      event.item.id,
      event.output,
    );
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    this.signalRService.leaveWorkspacesAdmin();
  }
}
