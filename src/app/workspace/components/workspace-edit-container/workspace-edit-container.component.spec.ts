// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  TerraformService,
  TerraformVersionsResult,
  Workspace,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { WorkspaceStore } from '../../state/workspace.store';
import { WorkspaceEditContainerComponent } from './workspace-edit-container.component';

@Component({ selector: 'cas-workspace-edit', template: '', standalone: false })
class WorkspaceEditStub {
  @Input() workspace: Workspace;
  @Input() terraformVersions: TerraformVersionsResult;
  @Input() maxParallelism: number;
  @Output() updateWorkspace = new EventEmitter<Partial<Workspace>>();
}

async function renderContainer() {
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
  const editWorkspaceComplete = vi.fn<(done: boolean) => void>();
  const view = await renderComponent(WorkspaceEditContainerComponent, {
    declarations: [WorkspaceEditStub],
    providers: [
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
  return { ...view, edit, workspacesApi, editWorkspaceComplete };
}

describe('WorkspaceEditContainerComponent', () => {
  /**
   * Verifies: the container passes the stored workspace, the Terraform versions and the max parallelism to the form.
   * Interacts with: TerraformService (stub), real WorkspaceQuery, the workspace-edit stub's inputs.
   * Data: workspace w1 dev; versions [1.5.7]; max parallelism 10.
   */
  it('feeds the edit form', async () => {
    const { edit } = await renderContainer();

    expect(edit.workspace.name).toBe('dev');
    expect(edit.terraformVersions.versions).toEqual(['1.5.7']);
    expect(edit.maxParallelism).toBe(10);
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
});
