// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { ModuleService } from 'src/app/modules/state/module.service';
import { ModuleQuery } from 'src/app/modules/state/module.query';
import { PermissionService } from 'src/app/permissions/permission.service';
import { AdminModulesComponent } from './modules.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderAdmin() {
  const load = vi.fn(() => of([]));
  const loadModuleById = vi.fn(() => of({}));
  const createOrUpdateModuleById = vi.fn(() => of({}));
  const deleteModule = vi.fn(() => of({}));

  const rendered = await renderComponent(AdminModulesComponent, {
    declarations: [AdminModulesComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      {
        provide: ModuleService,
        useValue: { load, loadModuleById, createOrUpdateModuleById, delete: deleteModule },
      },
      {
        provide: ModuleQuery,
        useValue: { selectAll: () => of([]), selectLoading: () => of(false) },
      },
      {
        provide: PermissionService,
        useValue: { hasPermission: () => of(false) },
      },
    ],
  });

  return { ...rendered, load, loadModuleById, createOrUpdateModuleById, deleteModule };
}

describe('AdminModulesComponent', () => {
  it('creates and loads modules on init', async () => {
    const { fixture, load } = await renderAdmin();
    expect(fixture.componentInstance).toBeTruthy();
    expect(load).toHaveBeenCalledWith(false, true);
  });

  it('load() dispatches to the service', async () => {
    const { fixture, load } = await renderAdmin();
    load.mockClear();
    fixture.componentInstance.load();
    expect(load).toHaveBeenCalledWith(false, true);
  });

  it('loadById() dispatches with the given id', async () => {
    const { fixture, loadModuleById } = await renderAdmin();
    fixture.componentInstance.loadById('mod-1');
    expect(loadModuleById).toHaveBeenCalledWith('mod-1');
  });

  it('createOrUpdateById() dispatches with the given id', async () => {
    const { fixture, createOrUpdateModuleById } = await renderAdmin();
    fixture.componentInstance.createOrUpdateById('mod-1');
    expect(createOrUpdateModuleById).toHaveBeenCalledWith('mod-1');
  });

  it('deleteModule() dispatches to ModuleService.delete', async () => {
    const { fixture, deleteModule } = await renderAdmin();
    fixture.componentInstance.deleteModule('mod-1');
    expect(deleteModule).toHaveBeenCalledWith('mod-1');
  });
});
