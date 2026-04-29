// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { Run } from 'src/app/generated/caster-api';
import { WorkspaceService } from 'src/app/workspace/state/workspace.service';
import { WorkspaceQuery } from 'src/app/workspace/state/workspace.query';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { AdminWorkspacesComponent } from './admin-workspaces.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderAdmin() {
  const workspaceService = {
    loadLockingStatus: vi.fn(),
    loadAllActiveRuns: vi.fn(),
    setLockingEnabled: vi.fn(),
    expandRun: vi.fn(),
    planOutputUpdated: vi.fn(),
    applyOutputUpdated: vi.fn(),
  };
  const workspaceQuery = {
    select: vi.fn(() => of(false)),
    activeRuns$: vi.fn(() => of([])),
    expandedRuns$: vi.fn(() => of([])),
  };
  const signalRService = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinWorkspacesAdmin: vi.fn(),
    leaveWorkspacesAdmin: vi.fn(),
  };

  const rendered = await renderComponent(AdminWorkspacesComponent, {
    declarations: [AdminWorkspacesComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: WorkspaceService, useValue: workspaceService },
      { provide: WorkspaceQuery, useValue: workspaceQuery },
      { provide: SignalRService, useValue: signalRService },
    ],
  });
  return { ...rendered, workspaceService, signalRService };
}

describe('AdminWorkspacesComponent', () => {
  it('creates and initializes on init', async () => {
    const { fixture, workspaceService, signalRService } = await renderAdmin();
    expect(fixture.componentInstance).toBeTruthy();
    expect(signalRService.startConnection).toHaveBeenCalled();
    expect(workspaceService.loadLockingStatus).toHaveBeenCalled();
    expect(workspaceService.loadAllActiveRuns).toHaveBeenCalled();
  });

  it('setLockingEnabled dispatches to the service', async () => {
    const { fixture, workspaceService } = await renderAdmin();
    fixture.componentInstance.setLockingEnabled(true);
    expect(workspaceService.setLockingEnabled).toHaveBeenCalledWith(true);
  });

  it('expandRun dispatches to the service', async () => {
    const { fixture, workspaceService } = await renderAdmin();
    const item: Run = { id: 'r1' } as Run;
    fixture.componentInstance.expandRun({ expand: true, item });
    expect(workspaceService.expandRun).toHaveBeenCalledWith(true, item);
  });

  it('planOutput dispatches with workspaceId + runId + output', async () => {
    const { fixture, workspaceService } = await renderAdmin();
    const item: Run = { id: 'r1', workspaceId: 'w1' } as Run;
    fixture.componentInstance.planOutput({ output: 'log', item });
    expect(workspaceService.planOutputUpdated).toHaveBeenCalledWith(
      'w1',
      'r1',
      'log',
    );
  });

  it('applyOutput dispatches with workspaceId + runId + output', async () => {
    const { fixture, workspaceService } = await renderAdmin();
    const item: Run = { id: 'r1', workspaceId: 'w1' } as Run;
    fixture.componentInstance.applyOutput({ output: 'log', item });
    expect(workspaceService.applyOutputUpdated).toHaveBeenCalledWith(
      'w1',
      'r1',
      'log',
    );
  });

  it('ngOnDestroy leaves the workspaces admin channel', async () => {
    const { fixture, signalRService } = await renderAdmin();
    fixture.componentInstance.ngOnDestroy();
    expect(signalRService.leaveWorkspacesAdmin).toHaveBeenCalled();
  });
});
