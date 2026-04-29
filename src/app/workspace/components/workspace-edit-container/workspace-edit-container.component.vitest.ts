// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import {
  TerraformService,
  Workspace,
} from 'src/app/generated/caster-api';
import { WorkspaceService } from 'src/app/workspace/state/workspace.service';
import { WorkspaceQuery } from 'src/app/workspace/state/workspace.query';
import { WorkspaceEditContainerComponent } from './workspace-edit-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderContainer() {
  const partialUpdate = vi.fn();
  const rendered = await renderComponent(WorkspaceEditContainerComponent, {
    declarations: [WorkspaceEditContainerComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { id: 'w1' },
    providers: [
      { provide: WorkspaceService, useValue: { partialUpdate } },
      { provide: WorkspaceQuery, useValue: { selectEntity: () => of({}) } },
      {
        provide: TerraformService,
        useValue: {
          getTerraformVersions: () => of({}),
          getTerraformMaxParallelism: () => of(10),
        },
      },
    ],
  });
  return { ...rendered, partialUpdate };
}

describe('WorkspaceEditContainerComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderContainer();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('onUpdateWorkspace persists and emits complete=true', async () => {
    const { fixture, partialUpdate } = await renderContainer();
    const spy = vi.fn();
    fixture.componentInstance.editWorkspaceComplete.subscribe(spy);
    const update: Partial<Workspace> = { name: 'new' };
    fixture.componentInstance.onUpdateWorkspace(update);
    expect(partialUpdate).toHaveBeenCalledWith('w1', update);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('onUpdateWorkspace(null) still emits complete=true without persisting', async () => {
    const { fixture, partialUpdate } = await renderContainer();
    const spy = vi.fn();
    fixture.componentInstance.editWorkspaceComplete.subscribe(spy);
    fixture.componentInstance.onUpdateWorkspace(null);
    expect(partialUpdate).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(true);
  });
});
