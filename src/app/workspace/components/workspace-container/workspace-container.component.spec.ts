// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Resource,
  ResourcesService,
  Run,
  RunsService,
  SystemPermission,
  Workspace,
} from 'src/app/generated/caster-api';
import { CwdTableComponent } from 'src/app/sei-cwd-common/cwd-table/components/cwd-table/cwd-table.component';
import { TableActionDirective } from 'src/app/sei-cwd-common/cwd-table/directives/table-action.directive';
import { TableItemActionDirective } from 'src/app/sei-cwd-common/cwd-table/directives/table-item-action.directive';
import { TableItemContentDirective } from 'src/app/sei-cwd-common/cwd-table/directives/table-item-content.directive';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { WorkspaceStore } from '../../state/workspace.store';
import { WorkspaceContainerComponent } from './workspace-container.component';

@Component({
  selector: 'cas-workspace-version',
  template: '',
  standalone: false,
})
class WorkspaceVersionStub {
  @Input() workspace: Workspace;
}

@Component({ selector: 'cas-run', template: '', standalone: false })
class RunStub {
  @Input() run: Run;
  @Input() loading: boolean;
  @Output() planOutput = new EventEmitter<string>();
  @Output() applyOutput = new EventEmitter<string>();
}

@Component({ selector: 'cas-import-resource', template: '', standalone: false })
class ImportResourceStub {
  @Input() workspaceId: string;
  @Input() loading: boolean;
  @Output() importComplete = new EventEmitter<boolean>();
}

@Component({ selector: 'cas-output', template: '', standalone: false })
class OutputStub {
  @Input() output: string;
  @Input() loading: boolean;
}

async function renderWorkspace(
  canEdit: boolean,
  grants: PermissionGrants = {},
) {
  const runsApi = {
    createRun: vi.fn(() =>
      of<Run>({ id: 'run1', workspaceId: 'w1', isDestroy: false }),
    ),
    getRunsByWorkspaceId: vi.fn((_id: string) => of<Run[]>([])),
  } satisfies ApiStub<RunsService>;
  const resourcesApi = {
    getResourcesByWorkspace: vi.fn((_id: string) => of<Resource[]>([])),
  } satisfies ApiStub<ResourcesService>;
  const signalR = {
    joinWorkspace: vi.fn(),
    leaveWorkspace: vi.fn(),
  } satisfies Pick<SignalRService, 'joinWorkspace' | 'leaveWorkspace'>;
  const view = await renderComponent(WorkspaceContainerComponent, {
    // The real cwd-table: an app NgModule's exports are not visible to the
    // test module, so its component and directives are declared here.
    declarations: [
      CwdTableComponent,
      TableActionDirective,
      TableItemActionDirective,
      TableItemContentDirective,
      WorkspaceVersionStub,
      RunStub,
      ImportResourceStub,
      OutputStub,
    ],
    imports: [
      MatToolbarModule,
      MatButtonToggleModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatCheckboxModule,
      MatDialogModule,
      MatFormFieldModule,
      MatInputModule,
      MatPaginatorModule,
      MatSortModule,
      MatExpansionModule,
      MatCardModule,
      MatProgressSpinnerModule,
    ],
    providers: [
      ...permissionDataProviders(grants),
      { provide: RunsService, useValue: runsApi },
      { provide: ResourcesService, useValue: resourcesApi },
      { provide: SignalRService, useValue: signalR },
    ],
    inputs: { workspaceId: 'w1', breadcrumb: [], canEdit },
    // The workspace is loaded before its tab opens.
    configureTestBed: (testBed) =>
      testBed
        .inject(WorkspaceStore)
        .set([{ id: 'w1', name: 'dev', runs: [], resources: [] }]),
  });
  const user = userEvent.setup();
  const openStateView = () =>
    user.click(screen.getByRole('radio', { name: 'versions' }));
  // The table's action area; the header row has a sortable Destroy column too.
  const actions = () =>
    within(view.container.querySelector('.list-actions') as HTMLElement);
  return { ...view, runsApi, signalR, openStateView, actions, user };
}

describe('WorkspaceContainerComponent', () => {
  /**
   * Verifies: with canEdit, Plan and Destroy are enabled for a workspace without runs, and Plan creates a plan run.
   * Interacts with: RunsService.createRun (stub), real WorkspaceService and WorkspaceQuery, SignalRService.joinWorkspace (stub).
   * Data: workspace dev with no runs; canEdit true.
   */
  it('plans the workspace when canEdit is true', async () => {
    const { runsApi, signalR, actions, user } = await renderWorkspace(true);

    expect(signalR.joinWorkspace).toHaveBeenCalledWith('w1');
    expect(actions().getByRole('button', { name: 'Destroy' })).toBeEnabled();
    await user.click(actions().getByRole('button', { name: 'Plan' }));

    expect(runsApi.createRun).toHaveBeenCalledWith({
      workspaceId: 'w1',
      isDestroy: false,
      replaceAddresses: [],
      targets: [],
    });
  });

  /**
   * Verifies: without canEdit, Plan and Destroy are disabled.
   * Interacts with: the [disabled]="!canEdit || ..." bindings in the runs view.
   * Data: workspace dev with no runs; canEdit false.
   */
  it('disables Plan and Destroy when canEdit is false', async () => {
    const { actions } = await renderWorkspace(false);

    expect(actions().getByRole('button', { name: 'Plan' })).toBeDisabled();
    expect(actions().getByRole('button', { name: 'Destroy' })).toBeDisabled();
  });

  /**
   * Verifies: in the state view Refresh follows canEdit and Import follows the ImportResources system permission.
   * Interacts with: PermissionService.hasPermission (real), ResourcesService.getResourcesByWorkspace (stub).
   * Data: canEdit true; system permission ImportResources; the state view opened.
   */
  it('enables Refresh and Import with canEdit and ImportResources', async () => {
    const { openStateView, actions } = await renderWorkspace(true, {
      system: [SystemPermission.ImportResources],
    });

    await openStateView();

    expect(actions().getByRole('button', { name: 'Refresh' })).toBeEnabled();
    expect(actions().getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  /**
   * Verifies: in the state view Import is disabled without ImportResources, even with canEdit, and Refresh is disabled without canEdit.
   * Interacts with: PermissionService.hasPermission (real).
   * Data: near miss: system permission ImportProjects; canEdit true, then false; the state view opened.
   */
  it.each([true, false])(
    'disables Import without ImportResources (canEdit %s)',
    async (canEdit) => {
      const { openStateView, actions } = await renderWorkspace(canEdit, {
        system: [SystemPermission.ImportProjects],
      });

      await openStateView();

      expect(actions().getByRole('button', { name: 'Import' })).toBeDisabled();
      expect(
        actions()
          .getByRole('button', { name: 'Refresh' })
          .hasAttribute('disabled'),
      ).toBe(!canEdit);
    },
  );
});
