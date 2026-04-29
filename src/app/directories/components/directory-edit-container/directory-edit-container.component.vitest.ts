// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import {
  Directory,
  TerraformService,
} from 'src/app/generated/caster-api';
import { DirectoryService } from 'src/app/directories/state/directory.service';
import { DirectoryQuery } from 'src/app/directories/state/directory.query';
import { DirectoryEditContainerComponent } from './directory-edit-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderContainer() {
  const partialUpdate = vi.fn();
  const rendered = await renderComponent(DirectoryEditContainerComponent, {
    declarations: [DirectoryEditContainerComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { id: 'dir-1' },
    providers: [
      { provide: DirectoryService, useValue: { partialUpdate } },
      { provide: DirectoryQuery, useValue: { selectEntity: () => of({}) } },
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

describe('DirectoryEditContainerComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderContainer();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('onUpdateDirectory persists and emits complete=true when directory provided', async () => {
    const { fixture, partialUpdate } = await renderContainer();
    const spy = vi.fn();
    fixture.componentInstance.editDirectoryComplete.subscribe(spy);
    const update: Partial<Directory> = { name: 'new' };
    fixture.componentInstance.onUpdateDirectory(update);
    expect(partialUpdate).toHaveBeenCalledWith('dir-1', update);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('onUpdateDirectory(null) still emits complete=true without persisting', async () => {
    const { fixture, partialUpdate } = await renderContainer();
    const spy = vi.fn();
    fixture.componentInstance.editDirectoryComplete.subscribe(spy);
    fixture.componentInstance.onUpdateDirectory(null);
    expect(partialUpdate).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(true);
  });
});
