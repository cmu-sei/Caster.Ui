// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  CapacityService,
  SystemPermission,
  TerraformService,
  TerraformVersionsResult,
  Workspace,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { DeploymentLimits } from 'src/app/shared/components/deployment-limits/deployment-limits';
import { renderComponent } from 'src/app/test-utils/render-component';
import { WorkspaceStore } from '../../state/workspace.store';
import { WorkspaceEditContainerComponent } from './workspace-edit-container.component';
import { WorkspaceEditComponent } from 'src/app/workspace/components/workspace-edit-container/workspace-edit/workspace-edit.component';

@Component({ selector: 'cas-workspace-edit', template: '' })
class WorkspaceEditStub {
  readonly workspace = input<Workspace>(undefined);
  readonly terraformVersions = input<TerraformVersionsResult>(undefined);
  readonly maxParallelism = input<number>(undefined);
  readonly canEditLimits = input<boolean>(false);
  readonly updateWorkspace = output<Partial<Workspace>>();
  readonly updateLimits = output<DeploymentLimits>();
}

async function renderContainer(grants: PermissionGrants = {}) {
  const terraformApi = {
    getTerraformVersions: vi.fn(() =>
      of<TerraformVersionsResult>({
        versions: ['1.5.7'],
        defaultVersion: '1.5.7',
      }),
    ),
    getTerraformMaxParallelism: vi.fn(() => of(10)),
  } satisfies ApiStub<TerraformService>;
  const workspacesApi = {
    partialEditWorkspace: vi.fn((id: string, w: Workspace) =>
      of<Workspace>({ ...w, id, runs: [] }),
    ),
  } satisfies ApiStub<WorkspacesService>;
  const capacityApi = {
    editWorkspaceLimits: vi.fn((id: string, limits?: DeploymentLimits) =>
      of<Workspace>({ id, name: 'dev', runs: [], ...limits }),
    ),
  } satisfies ApiStub<CapacityService>;
  const editWorkspaceComplete = vi.fn<(done: boolean) => void>();
  const view = await renderComponent(WorkspaceEditContainerComponent, {
    childStubs: [{ replace: WorkspaceEditComponent, with: WorkspaceEditStub }],
    providers: [
      ...permissionDataProviders(grants),
      { provide: CapacityService, useValue: capacityApi },
      { provide: TerraformService, useValue: terraformApi },
      { provide: WorkspacesService, useValue: workspacesApi },
    ],
    inputs: { id: 'w1' },
    on: { editWorkspaceComplete },
    // The workspace is in the store before the edit opens, as when the
    // directory panel opens it.
    configureTestBed: (testBed) =>
      testBed.inject(WorkspaceStore).set([{ id: 'w1', name: 'dev', runs: [] }]),
  });
  const edit: WorkspaceEditStub = view.fixture.debugElement.query(
    By.directive(WorkspaceEditStub),
  ).componentInstance;
  return { ...view, edit, workspacesApi, capacityApi, editWorkspaceComplete };
}

describe('WorkspaceEditContainerComponent', () => {
  /**
   * Verifies: the container passes the stored workspace, the Terraform versions and the max parallelism to the form.
   * Interacts with: TerraformService (stub), real WorkspaceQuery, the workspace-edit stub's inputs.
   * Data: workspace w1 dev; versions [1.5.7]; max parallelism 10.
   */
  it('feeds the edit form', async () => {
    const { edit } = await renderContainer();

    expect(edit.workspace().name).toBe('dev');
    expect(edit.terraformVersions().versions).toEqual(['1.5.7']);
    expect(edit.maxParallelism()).toBe(10);
  });

  /**
   * Verifies: a saved change is sent to the API and completes the edit; a cancel completes it without a call.
   * Interacts with: the stub's updateWorkspace output, WorkspacesService.partialEditWorkspace (stub), the editWorkspaceComplete output.
   * Data: name changed to staging, then a cancel (null).
   */
  it('saves a change and completes the edit', async () => {
    const { edit, workspacesApi, editWorkspaceComplete } =
      await renderContainer();

    edit.updateWorkspace.emit({ name: 'staging' });
    expect(workspacesApi.partialEditWorkspace).toHaveBeenCalledWith('w1', {
      name: 'staging',
    });

    edit.updateWorkspace.emit(null);
    expect(workspacesApi.partialEditWorkspace).toHaveBeenCalledTimes(1);
    expect(editWorkspaceComplete).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: the form may set the deployment limits only with EditProjects, and saved limits are sent to the API.
   * Interacts with: PermissionService.hasPermission (real); the stub's canEditLimits input and updateLimits output; CapacityService.editWorkspaceLimits (stub).
   * Data: system permission EditProjects, then none; max vCPU 16.
   */
  it('lets an admin set the deployment limits', async () => {
    const { edit, capacityApi } = await renderContainer({
      system: [SystemPermission.EditProjects],
    });

    expect(edit.canEditLimits()).toBe(true);
    edit.updateLimits.emit({ maxVcpu: 16 });
    expect(capacityApi.editWorkspaceLimits).toHaveBeenCalledWith('w1', {
      maxVcpu: 16,
    });
  });

  /**
   * Verifies: without EditProjects the form does not offer the deployment limits.
   * Interacts with: PermissionService.hasPermission (real); the stub's canEditLimits input.
   * Data: near miss: system permission ViewProjects.
   */
  it('does not let a project member set the deployment limits', async () => {
    const { edit } = await renderContainer({
      system: [SystemPermission.ViewProjects],
    });

    expect(edit.canEditLimits()).toBe(false);
  });
});
