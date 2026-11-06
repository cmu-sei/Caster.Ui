// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  OnDestroy,
  inject,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WorkspaceService, WorkspaceQuery } from 'src/app/workspace/state';
import { EMPTY, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Run } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { MatCard } from '@angular/material/card';
import { LockingStatusComponent } from './locking-status/locking-status.component';
import { ActiveRunsComponent } from './active-runs/active-runs.component';
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
  imports: [MatCard, LockingStatusComponent, ActiveRunsComponent, AsyncPipe],
})
export class AdminWorkspacesComponent implements OnInit, OnDestroy {
  private workspaceService = inject(WorkspaceService);
  private workspaceQuery = inject(WorkspaceQuery);
  private signalRService = inject(SignalRService);
  private snackBar = inject(MatSnackBar);

  public lockingEnabled$: Observable<boolean>;
  public activeRuns$: Observable<Run[]>;
  public expandedRuns$: Observable<string[]>;

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
      )
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe();
    this.activeRuns$ = this.workspaceQuery.activeRuns$();
    this.expandedRuns$ = this.workspaceQuery.expandedRuns$();
  }

  setLockingEnabled(status: boolean) {
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
    this.signalRService.leaveWorkspacesAdmin();
  }
}
