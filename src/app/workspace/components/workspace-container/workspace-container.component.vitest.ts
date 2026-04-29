// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { of } from 'rxjs';
import { Resource, Run, RunStatus } from 'src/app/generated/caster-api';
import { WorkspaceService } from 'src/app/workspace/state/workspace.service';
import { WorkspaceQuery } from 'src/app/workspace/state/workspace.query';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { CurrentUserQuery } from 'src/app/users/state';
import { PermissionService } from 'src/app/permissions/permission.service';
import { WorkspaceContainerComponent } from './workspace-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderContainer(
  overrides: { confirmCancel?: boolean } = {},
) {
  const { confirmCancel = false } = overrides;
  const workspaceService = {
    createPlanRun: vi.fn(() => of({})),
    rejectRun: vi.fn(() => of({})),
    cancelRun: vi.fn(() => of({})),
    applyRun: vi.fn(() => of({})),
    saveState: vi.fn(() => of({})),
    taint: vi.fn(() => of({ errors: [] })),
    untaint: vi.fn(() => of({ errors: [] })),
    remove: vi.fn(() => of({ errors: [] })),
    refreshResources: vi.fn(() => of({ errors: [] })),
    expandRun: vi.fn(),
    expandResource: vi.fn(),
    loadResource: vi.fn(),
    loadRunsByWorkspaceId: vi.fn(() => of([])),
    loadResourcesByWorkspaceId: vi.fn(() => of([])),
    setWorkspaceView: vi.fn(),
    setStatusFilters: vi.fn(),
    planOutputUpdated: vi.fn(),
    applyOutputUpdated: vi.fn(),
  };
  const workspaceQuery = {
    selectLoading: () => of(false),
    selectEntity: () => of({}),
    workspaceRuns$: () => of([]),
    workspaceResources$: () => of([]),
    expandedRuns$: () => of([]),
    expandedResources$: () => of([]),
    selectedRuns$: () => of([]),
    resourceActions$: () => of([]),
    resourceAction$: () => of({}),
    filters$: () => of([]),
    getWorkspaceView: () => of('runs'),
  };
  const signalRService = {
    joinWorkspace: vi.fn(),
    leaveWorkspace: vi.fn(),
  };
  const confirmService = {
    confirmDialog: vi.fn(() => of({ wasCancelled: confirmCancel })),
    WAS_CANCELLED: 'wasCancelled',
  };

  const rendered = await renderComponent(WorkspaceContainerComponent, {
    declarations: [WorkspaceContainerComponent],
    imports: [MatButtonToggleModule],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { workspaceId: 'w1', breadcrumb: [], canEdit: true },
    providers: [
      { provide: WorkspaceService, useValue: workspaceService },
      { provide: WorkspaceQuery, useValue: workspaceQuery },
      { provide: SignalRService, useValue: signalRService },
      { provide: ConfirmDialogService, useValue: confirmService },
      { provide: CurrentUserQuery, useValue: { select: () => of({}) } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      {
        provide: PermissionService,
        useValue: { hasPermission: () => of(true) },
      },
    ],
  });

  return { ...rendered, workspaceService, signalRService, confirmService };
}

describe('WorkspaceContainerComponent', () => {
  it('creates and joins the workspace signalR channel on init', async () => {
    const { fixture, signalRService } = await renderContainer();
    expect(fixture.componentInstance).toBeTruthy();
    expect(signalRService.joinWorkspace).toHaveBeenCalledWith('w1');
  });

  it('ngOnDestroy leaves the workspace channel', async () => {
    const { fixture, signalRService } = await renderContainer();
    fixture.componentInstance.ngOnDestroy();
    expect(signalRService.leaveWorkspace).toHaveBeenCalledWith('w1');
  });

  it('plan() dispatches createPlanRun and resets replace/target lists', async () => {
    const { fixture, workspaceService } = await renderContainer();
    fixture.componentInstance.resourcesToReplace = ['r1'];
    fixture.componentInstance.resourcesToTarget = ['t1'];
    fixture.componentInstance.plan({ stopPropagation: () => {} } as Event);
    expect(fixture.componentInstance.resourcesToReplace).toEqual([]);
    expect(fixture.componentInstance.resourcesToTarget).toEqual([]);
    expect(workspaceService.createPlanRun).toHaveBeenCalledWith('w1', false, [], []);
  });

  it('plan(null) does not reset resource lists', async () => {
    const { fixture, workspaceService } = await renderContainer();
    fixture.componentInstance.resourcesToReplace = ['r1'];
    fixture.componentInstance.plan(null);
    expect(fixture.componentInstance.resourcesToReplace).toEqual(['r1']);
    expect(workspaceService.createPlanRun).toHaveBeenCalled();
  });

  it('reject dispatches rejectRun with runId', async () => {
    const { fixture, workspaceService } = await renderContainer();
    fixture.componentInstance.reject(
      { stopPropagation: () => {} } as Event,
      { id: 'run-1' } as Run,
    );
    expect(workspaceService.rejectRun).toHaveBeenCalledWith('w1', 'run-1');
  });

  it('cancel dispatches cancelRun only after confirm', async () => {
    const { fixture, workspaceService } = await renderContainer({
      confirmCancel: false,
    });
    fixture.componentInstance.cancel(
      { stopPropagation: () => {} } as Event,
      { id: 'run-1' } as Run,
    );
    expect(workspaceService.cancelRun).toHaveBeenCalledWith('w1', 'run-1', false);
  });

  it('cancel is a no-op when confirmation is cancelled', async () => {
    const { fixture, workspaceService } = await renderContainer({
      confirmCancel: true,
    });
    fixture.componentInstance.cancel(
      { stopPropagation: () => {} } as Event,
      { id: 'run-1' } as Run,
    );
    expect(workspaceService.cancelRun).not.toHaveBeenCalled();
  });

  it('apply dispatches applyRun', async () => {
    const { fixture, workspaceService } = await renderContainer();
    fixture.componentInstance.apply(
      { stopPropagation: () => {} } as Event,
      { id: 'run-1' } as Run,
    );
    expect(workspaceService.applyRun).toHaveBeenCalledWith('w1', 'run-1');
  });

  it('destroy dispatches createPlanRun(isDestroy=true)', async () => {
    const { fixture, workspaceService } = await renderContainer();
    fixture.componentInstance.destroy({ stopPropagation: () => {} } as Event);
    expect(workspaceService.createPlanRun).toHaveBeenCalledWith(
      'w1',
      true,
      null,
      null,
    );
  });

  it('markResourceForReplace adds/removes ids based on checked', async () => {
    const { fixture } = await renderContainer();
    fixture.componentInstance.markResourceForReplace({ checked: true }, 'r1');
    fixture.componentInstance.markResourceForReplace({ checked: true }, 'r2');
    expect(fixture.componentInstance.resourcesToReplace).toEqual(['r1', 'r2']);
    fixture.componentInstance.markResourceForReplace({ checked: false }, 'r1');
    expect(fixture.componentInstance.resourcesToReplace).toEqual(['r2']);
  });

  it('resourceToReplace and resourceToTarget query membership', async () => {
    const { fixture } = await renderContainer();
    fixture.componentInstance.resourcesToReplace = ['r1'];
    fixture.componentInstance.resourcesToTarget = ['t1'];
    expect(fixture.componentInstance.resourceToReplace('r1')).toBe(true);
    expect(fixture.componentInstance.resourceToReplace('x')).toBe(false);
    expect(fixture.componentInstance.resourceToTarget('t1')).toBe(true);
    expect(fixture.componentInstance.resourceToTarget('x')).toBe(false);
  });

  it('enablePlanApply returns true when no runs', async () => {
    const { fixture } = await renderContainer();
    fixture.componentInstance.workspaceRuns = [];
    expect(fixture.componentInstance.enablePlanApply()).toBe(true);
  });

  it('enablePlanApply returns false when a run is in flight', async () => {
    const { fixture } = await renderContainer();
    fixture.componentInstance.workspaceRuns = [
      { id: 'r1', status: RunStatus.Planning } as Run,
    ];
    expect(fixture.componentInstance.enablePlanApply()).toBe(false);
  });

  it('hasPlan returns true for a Planned run', async () => {
    const { fixture } = await renderContainer();
    expect(
      fixture.componentInstance.hasPlan({ status: RunStatus.Planned } as Run),
    ).toBe(true);
  });

  it('isCancelable returns true for Planning / Applying / Queued statuses', async () => {
    const { fixture } = await renderContainer();
    expect(
      fixture.componentInstance.isCancelable({ status: RunStatus.Planning } as Run),
    ).toBe(true);
    expect(
      fixture.componentInstance.isCancelable({ status: RunStatus.Applied } as Run),
    ).toBe(false);
  });

  it('setRowStyle marks isDestroy runs / tainted resources', async () => {
    const { fixture } = await renderContainer();
    expect(
      fixture.componentInstance.setRowStyle({ isDestroy: true } as Run),
    ).toBe('isDestroy');
    expect(
      fixture.componentInstance.setRowStyle({ tainted: true } as Resource),
    ).toBe('isDestroy');
    expect(fixture.componentInstance.setRowStyle(null)).toEqual({});
  });

  it('ngOnChanges builds the breadcrumb string', async () => {
    const { fixture } = await renderContainer();
    fixture.componentInstance.breadcrumb = [
      { name: 'Project' },
      { name: 'File' },
    ] as never;
    fixture.componentInstance.ngOnChanges({} as never);
    expect(fixture.componentInstance.breadcrumbString).toBe('  >  Project  >  File');
  });
});
