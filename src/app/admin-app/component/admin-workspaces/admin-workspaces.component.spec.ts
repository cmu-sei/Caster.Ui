// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import {
  Run,
  RunsService,
  RunStatus,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminWorkspacesComponent } from './admin-workspaces.component';

@Component({ selector: 'cas-locking-status', template: '', standalone: false })
class LockingStatusStub {
  @Input() lockingEnabled: boolean;
  @Output() setLockingEnabled = new EventEmitter<boolean>();
}

@Component({ selector: 'cas-active-runs', template: '', standalone: false })
class ActiveRunsStub {
  @Input() runs: Run[];
  @Input() expandedRuns: string[];
  @Output() expandRun = new EventEmitter<{ expand: boolean; item: Run }>();
  @Output() planUpdated = new EventEmitter<{ output: string; item: Run }>();
  @Output() applyUpdated = new EventEmitter<{ output: string; item: Run }>();
}

async function renderAdminWorkspaces() {
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinWorkspacesAdmin: vi.fn(),
    leaveWorkspacesAdmin: vi.fn(),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'joinWorkspacesAdmin' | 'leaveWorkspacesAdmin'
  >;
  const workspacesApi = {
    getWorkspaceLockingStatus: vi.fn(() => of(true)),
    disableWorkspaceLocking: vi.fn(() => of(false)),
  } satisfies ApiStub<WorkspacesService>;
  const runsApi = {
    getRuns: vi.fn(() =>
      of<Run[]>([
        { id: 'run1', workspaceId: 'w1', status: RunStatus.Planning },
        { id: 'run2', workspaceId: 'w1', status: RunStatus.Applied },
      ]),
    ),
  } satisfies ApiStub<RunsService>;
  const view = await renderComponent(AdminWorkspacesComponent, {
    declarations: [LockingStatusStub, ActiveRunsStub],
    imports: [MatCardModule],
    providers: [
      { provide: SignalRService, useValue: signalR },
      { provide: WorkspacesService, useValue: workspacesApi },
      { provide: RunsService, useValue: runsApi },
    ],
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  const stub = <T>(type: Type<T>): T =>
    view.fixture.debugElement.query(By.directive(type)).componentInstance;
  return { ...view, signalR, workspacesApi, stub };
}

describe('AdminWorkspacesComponent', () => {
  /**
   * Verifies: the page joins the workspace admin hub group, passes the loaded locking status to the locking toggle and only the active runs to the run list.
   * Interacts with: SignalRService (stub), WorkspacesService.getWorkspaceLockingStatus and RunsService.getRuns (stubs), real WorkspaceService and WorkspaceQuery, the child stubs' inputs.
   * Data: locking enabled; runs run1 (Planning) and run2 (Applied) in workspace w1.
   */
  it('shows the locking status and the active runs', async () => {
    const { signalR, stub } = await renderAdminWorkspaces();

    expect(signalR.joinWorkspacesAdmin).toHaveBeenCalled();
    expect(stub(LockingStatusStub).lockingEnabled).toBe(true);
    expect(stub(ActiveRunsStub).runs.map((r) => r.id)).toEqual(['run1']);
    expect(stub(ActiveRunsStub).expandedRuns).toEqual([]);
  });

  /**
   * Verifies: turning locking off from the toggle disables it through the API and passes the new status back to the toggle.
   * Interacts with: the locking stub's setLockingEnabled output, WorkspacesService.disableWorkspaceLocking (stub), real WorkspaceStore.
   * Data: locking enabled, then set to false.
   */
  it('disables workspace locking', async () => {
    const { fixture, workspacesApi, stub } = await renderAdminWorkspaces();

    stub(LockingStatusStub).setLockingEnabled.emit(false);
    fixture.detectChanges();

    expect(workspacesApi.disableWorkspaceLocking).toHaveBeenCalled();
    expect(stub(LockingStatusStub).lockingEnabled).toBe(false);
  });
});
