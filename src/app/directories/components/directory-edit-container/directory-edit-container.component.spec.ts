// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  DirectoriesService,
  Directory,
  TerraformService,
  TerraformVersionsResult,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DirectoryStore } from '../../state/directory.store';
import { DirectoryEditContainerComponent } from './directory-edit-container.component';

@Component({ selector: 'cas-directory-edit', template: '', standalone: false })
class DirectoryEditStub {
  @Input() directory: Directory;
  @Input() terraformVersions: TerraformVersionsResult;
  @Input() maxParallelism: number;
  @Output() updateDirectory = new EventEmitter<Partial<Directory>>();
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
  const directoriesApi = {
    partialEditDirectory: vi.fn((id: string, d: Partial<Directory>) =>
      of<Directory>({ id, name: 'network', projectId: 'p1', ...d }),
    ),
  } satisfies ApiStub<DirectoriesService>;
  const editDirectoryComplete = vi.fn<(done: boolean) => void>();
  const view = await renderComponent(DirectoryEditContainerComponent, {
    declarations: [DirectoryEditStub],
    providers: [
      { provide: TerraformService, useValue: terraformApi },
      { provide: DirectoriesService, useValue: directoriesApi },
    ],
    inputs: { id: 'dir1' },
    on: { editDirectoryComplete },
  });
  TestBed.inject(DirectoryStore).set([
    { id: 'dir1', name: 'network', projectId: 'p1' },
  ]);
  view.fixture.detectChanges();
  const edit: DirectoryEditStub = view.fixture.debugElement.query(
    By.directive(DirectoryEditStub),
  ).componentInstance;
  return { ...view, edit, directoriesApi, editDirectoryComplete };
}

describe('DirectoryEditContainerComponent', () => {
  /**
   * Verifies: the container passes the stored directory, the Terraform versions and the max parallelism to the form.
   * Interacts with: TerraformService (stub), real DirectoryQuery, the directory-edit stub's inputs.
   * Data: directory dir1; versions [1.5.7]; max parallelism 10.
   */
  it('feeds the edit form', async () => {
    const { edit } = await renderContainer();

    expect(edit.directory.name).toBe('network');
    expect(edit.terraformVersions.versions).toEqual(['1.5.7']);
    expect(edit.maxParallelism).toBe(10);
  });

  /**
   * Verifies: a saved change is sent to the API and completes the edit; a cancel completes it without a call.
   * Interacts with: the stub's updateDirectory output, DirectoriesService.partialEditDirectory (stub), the editDirectoryComplete output.
   * Data: name changed to core, then a cancel (null).
   */
  it('saves a change and completes the edit', async () => {
    const { edit, directoriesApi, editDirectoryComplete } =
      await renderContainer();

    edit.updateDirectory.emit({ name: 'core' });
    expect(directoriesApi.partialEditDirectory).toHaveBeenCalledWith('dir1', {
      name: 'core',
    });

    edit.updateDirectory.emit(null);
    expect(directoriesApi.partialEditDirectory).toHaveBeenCalledTimes(1);
    expect(editDirectoryComplete).toHaveBeenCalledTimes(2);
  });
});
