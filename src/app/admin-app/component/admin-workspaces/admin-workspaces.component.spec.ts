// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Type, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Observable, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import {
  DirectoriesService,
  ProjectsService,
  Run,
  RunsService,
  RunStatus,
  SystemPermission,
  Workspace,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminWorkspacesComponent } from './admin-workspaces.component';
import {
  ActiveRunsComponent,
  RunWorkspace,
} from 'src/app/admin-app/component/admin-workspaces/active-runs/active-runs.component';
import { LockingStatusComponent } from 'src/app/admin-app/component/admin-workspaces/locking-status/locking-status.component';

@Component({ selector: 'cas-locking-status', template: '' })
class LockingStatusStub {
  readonly lockingEnabled = input<boolean>(undefined);
  readonly canManage = input<boolean>(false);
  readonly busy = input<boolean>(false);
  readonly setLockingEnabled = output<boolean>();
}

// Projects its content, as the real list does with the locking toggle.
@Component({ selector: 'cas-active-runs', template: '<ng-content />' })
class ActiveRunsStub {
  readonly runs = input<Run[]>(undefined);
  readonly expandedRuns = input<string[]>(undefined);
  readonly workspaces = input<Record<string, RunWorkspace | null>>({});
  readonly loading = input<boolean>(false);
  readonly expandRun = output<{
    expand: boolean;
    item: Run;
  }>();
  readonly planUpdated = output<{
    output: string;
    item: Run;
  }>();
  readonly applyUpdated = output<{
    output: string;
    item: Run;
  }>();
}

async function renderAdminWorkspaces(
  overrides: {
    disableWorkspaceLocking?: () => Observable<boolean>;
    grants?: PermissionGrants;
  } = {},
) {
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
    getWorkspace: vi.fn((id: string) =>
      id === 'w1'
        ? of<Workspace>({ id, name: 'Range', directoryId: 'd1', runs: [] })
        : throwError(() => new HttpErrorResponse({ status: 403 })),
    ),
    disableWorkspaceLocking: vi.fn(
      overrides.disableWorkspaceLocking ?? (() => of(false)),
    ),
  } satisfies ApiStub<WorkspacesService>;
  const directoriesApi = {
    getDirectory: vi.fn((id: string) =>
      of({ id, name: 'Root', projectId: 'p1' }),
    ),
  } satisfies ApiStub<DirectoriesService>;
  const projectsApi = {
    getProject: vi.fn((id: string) => of({ id, name: 'Exercise' })),
  } satisfies ApiStub<ProjectsService>;
  const snackBar = { open: vi.fn() };
  const runsApi = {
    getRuns: vi.fn(() =>
      of<Run[]>([
        { id: 'run1', workspaceId: 'w1', status: RunStatus.Planning },
        { id: 'run2', workspaceId: 'w1', status: RunStatus.Applied },
        { id: 'run3', workspaceId: 'w2', status: RunStatus.Queued },
      ]),
    ),
  } satisfies ApiStub<RunsService>;
  const view = await renderComponent(AdminWorkspacesComponent, {
    childStubs: [
      { replace: LockingStatusComponent, with: LockingStatusStub },
      { replace: ActiveRunsComponent, with: ActiveRunsStub },
    ],
    imports: [MatCardModule],
    providers: [
      ...permissionDataProviders(
        overrides.grants ?? { system: [SystemPermission.ManageWorkspaces] },
      ),
      { provide: SignalRService, useValue: signalR },
      { provide: WorkspacesService, useValue: workspacesApi },
      { provide: RunsService, useValue: runsApi },
      { provide: DirectoriesService, useValue: directoriesApi },
      { provide: ProjectsService, useValue: projectsApi },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  const stub = <T>(type: Type<T>): T =>
    view.fixture.debugElement.query(By.directive(type)).componentInstance;
  return { ...view, signalR, workspacesApi, snackBar, stub };
}

describe('AdminWorkspacesComponent', () => {
  /**
   * Verifies: the page joins the workspace admin hub group, passes the loaded locking status to the locking toggle and only the active runs to the run list, then clears loading.
   * Interacts with: SignalRService (stub), WorkspacesService.getWorkspaceLockingStatus and RunsService.getRuns (stubs), real WorkspaceService and WorkspaceQuery, the child stubs' inputs.
   * Data: locking enabled; runs run1 (Planning) and run2 (Applied) in workspace w1, run3 (Queued) in w2.
   */
  it('shows the locking status and the active runs', async () => {
    const { signalR, stub } = await renderAdminWorkspaces();

    expect(signalR.joinWorkspacesAdmin).toHaveBeenCalled();
    expect(stub(LockingStatusStub).lockingEnabled()).toBe(true);
    expect(
      stub(ActiveRunsStub)
        .runs()
        .map((r) => r.id),
    ).toEqual(['run1', 'run3']);
    expect(stub(ActiveRunsStub).expandedRuns()).toEqual([]);
    expect(stub(ActiveRunsStub).loading()).toBe(false);
  });

  /**
   * Verifies: each active run's Workspace is named with its Project, and a Workspace the viewer can't read is passed as null instead of raising the error dialog.
   * Interacts with: WorkspacesService.getWorkspace, DirectoriesService.getDirectory and ProjectsService.getProject (stubs), the run list stub's workspaces input.
   * Data: run1 in w1 (Range, directory d1 in Project p1 Exercise); run3 in w2, which answers 403.
   */
  it('names the Workspace and Project of each active run', async () => {
    const { stub } = await renderAdminWorkspaces();

    expect(stub(ActiveRunsStub).workspaces()).toEqual({
      w1: { name: 'Range', projectId: 'p1', projectName: 'Exercise' },
      w2: null,
    });
  });

  /**
   * Verifies: turning locking off from the toggle disables it through the API and passes the new status back to the toggle.
   * Interacts with: the locking stub's setLockingEnabled output, WorkspacesService.disableWorkspaceLocking (stub), real WorkspaceStore.
   * Data: locking enabled, then set to false.
   */
  it('disables workspace locking', async () => {
    const { fixture, workspacesApi, snackBar, stub } =
      await renderAdminWorkspaces();

    stub(LockingStatusStub).setLockingEnabled.emit(false);
    fixture.detectChanges();

    expect(workspacesApi.disableWorkspaceLocking).toHaveBeenCalled();
    expect(stub(LockingStatusStub).lockingEnabled()).toBe(false);
    expect(snackBar.open).toHaveBeenCalledWith(
      'Workspace operations are disabled until you enable them or the Caster API restarts',
      'Dismiss',
      expect.objectContaining({ duration: 5000, verticalPosition: 'top' }),
    );
  });

  /**
   * Verifies: when the API refuses to disable locking, its reason shows in a snack bar (not the global error dialog) and the toggle keeps the old state.
   * Interacts with: WorkspacesService.disableWorkspaceLocking (stub that fails with a 403 ProblemDetails), MatSnackBar (stub).
   * Data: locking enabled; the API answers 403 "Forbidden".
   */
  it('shows why disabling workspace locking failed', async () => {
    const { fixture, snackBar, stub } = await renderAdminWorkspaces({
      disableWorkspaceLocking: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: { title: 'Forbidden', status: 403 },
            }),
        ),
    });

    stub(LockingStatusStub).setLockingEnabled.emit(false);
    fixture.detectChanges();

    expect(snackBar.open).toHaveBeenCalledWith(
      'Forbidden',
      'Dismiss',
      expect.objectContaining({ duration: 5000 }),
    );
    expect(stub(LockingStatusStub).lockingEnabled()).toBe(true);
  });

  /**
   * Verifies: with ManageWorkspaces the locking toggle can be changed.
   * Interacts with: PermissionService.hasPermission (real), the locking stub's canManage input.
   * Data: system permission ManageWorkspaces.
   */
  it('lets Workspace managers change the locking status', async () => {
    const { stub } = await renderAdminWorkspaces();
    expect(stub(LockingStatusStub).canManage()).toBe(true);
  });

  /**
   * Verifies: with ViewWorkspaces alone the locking toggle can't be changed, as the API requires ManageWorkspaces.
   * Interacts with: PermissionService.hasPermission (real), the locking stub's canManage input.
   * Data: near miss: system permission ViewWorkspaces only.
   */
  it('keeps Workspace viewers from changing the locking status', async () => {
    const { stub } = await renderAdminWorkspaces({
      grants: { system: [SystemPermission.ViewWorkspaces] },
    });
    expect(stub(LockingStatusStub).canManage()).toBe(false);
  });
});
