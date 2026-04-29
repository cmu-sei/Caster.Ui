// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import {
  Directory,
  TerraformVersionsResult,
} from 'src/app/generated/caster-api';
import { DirectoryEditComponent } from './directory-edit.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const directory: Directory = {
  id: 'd1',
  name: 'alpha',
  terraformVersion: '1.5.0',
  parallelism: 10,
  azureDestroyFailureThreshold: 3,
  azureDestroyFailureThresholdEnabled: true,
} as Directory;

const versions: TerraformVersionsResult = {
  versions: ['1.3.0', '1.5.0', '1.10.0'],
} as TerraformVersionsResult;

async function renderEdit(overrides: { directory?: Directory } = {}) {
  const { directory: d = directory } = overrides;
  return renderComponent(DirectoryEditComponent, {
    declarations: [DirectoryEditComponent],
    imports: [MatCheckboxModule, MatSelectModule],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: {
      directory: d,
      terraformVersions: versions,
      maxParallelism: 32,
    },
  });
}

describe('DirectoryEditComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderEdit();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('ngOnInit patches form values from directory', async () => {
    const { fixture } = await renderEdit();
    const v = fixture.componentInstance.form.getRawValue();
    expect(v.name).toBe('alpha');
    expect(v.terraformVersion).toBe('1.5.0');
    expect(v.parallelism).toBe(10);
  });

  it('sorts terraform versions naturally (newest first)', async () => {
    const { fixture } = await renderEdit();
    expect(fixture.componentInstance.sortedVersions).toEqual([
      '1.10.0',
      '1.5.0',
      '1.3.0',
    ]);
  });

  it('disables azureDestroyFailureThreshold when the flag is off', async () => {
    const { fixture } = await renderEdit({
      directory: {
        ...directory,
        azureDestroyFailureThresholdEnabled: false,
      } as Directory,
    });
    expect(
      fixture.componentInstance.azureDestroyFailureThreshold.disabled,
    ).toBe(true);
  });

  it('save() emits only the dirty fields', async () => {
    const { fixture } = await renderEdit();
    const spy = vi.fn();
    fixture.componentInstance.updateDirectory.subscribe(spy);
    const nameCtrl = fixture.componentInstance.form.get('name');
    nameCtrl.setValue('renamed');
    nameCtrl.markAsDirty();
    fixture.componentInstance.save();
    expect(spy).toHaveBeenCalledWith({ name: 'renamed' });
  });

  it('cancel() emits null', async () => {
    const { fixture } = await renderEdit();
    const spy = vi.fn();
    fixture.componentInstance.updateDirectory.subscribe(spy);
    fixture.componentInstance.cancel();
    expect(spy).toHaveBeenCalledWith(null);
  });

  it('toggleAzureThresholdEnabled(checked=true) enables the control', async () => {
    const { fixture } = await renderEdit({
      directory: {
        ...directory,
        azureDestroyFailureThresholdEnabled: false,
      } as Directory,
    });
    fixture.componentInstance.toggleAzureThresholdEnabled({
      checked: true,
    } as MatCheckboxChange);
    expect(
      fixture.componentInstance.azureDestroyFailureThreshold.enabled,
    ).toBe(true);
  });

  it('toggleAzureThresholdEnabled(checked=false) disables the control', async () => {
    const { fixture } = await renderEdit();
    fixture.componentInstance.toggleAzureThresholdEnabled({
      checked: false,
    } as MatCheckboxChange);
    expect(
      fixture.componentInstance.azureDestroyFailureThreshold.disabled,
    ).toBe(true);
  });
});
