// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { WorkspaceService, WorkspaceQuery } from 'src/app/workspace/state';
import { Observable } from 'rxjs';
import { Run } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';

@Component({
  selector: 'cas-admin-workspaces',
  templateUrl: './admin-workspaces.component.html',
  styleUrls: ['./admin-workspaces.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminWorkspacesComponent implements OnInit, OnDestroy {
  public lockingEnabled$: Observable<boolean>;
  public activeRuns$: Observable<Run[]>;
  public expandedRuns$: Observable<string[]>;

  constructor(
    private workspaceService: WorkspaceService,
    private workspaceQuery: WorkspaceQuery,
    private signalRService: SignalRService
  ) {}

  ngOnInit() {
    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinWorkspacesAdmin();
      })
      .catch((err) => {
        console.log(err);
      });

    this.workspaceService.loadLockingStatus();
    this.lockingEnabled$ = this.workspaceQuery.select(
      (state) => state.lockingEnabled
    );

    this.workspaceService.loadAllActiveRuns();
    this.activeRuns$ = this.workspaceQuery.activeRuns$();
    this.expandedRuns$ = this.workspaceQuery.expandedRuns$();
  }

  setLockingEnabled(status: boolean) {
    this.workspaceService.setLockingEnabled(status);
  }

  expandRun(event: { expand: boolean; item: Run }) {
    this.workspaceService.expandRun(event.expand, event.item);
  }

  planOutput(event: { output: string; item: Run }) {
    this.workspaceService.planOutputUpdated(
      event.item.workspaceId,
      event.item.id,
      event.output
    );
  }

  applyOutput(event: { output: string; item: Run }) {
    this.workspaceService.applyOutputUpdated(
      event.item.workspaceId,
      event.item.id,
      event.output
    );
  }

  ngOnDestroy() {
    this.signalRService.leaveWorkspacesAdmin();
  }
}
