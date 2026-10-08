// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  Module,
  ModulesService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminModulesComponent } from './modules.component';

@Component({
  selector: 'cas-admin-module-list',
  template: '',
  standalone: false,
})
class ModuleListStub {
  @Input() modules: Module[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() load = new EventEmitter<boolean>();
  @Output() loadModuleById = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
}

async function renderModules(grants: PermissionGrants) {
  const modulesApi = {
    getAllModules: vi.fn(() =>
      of<Module[]>([{ id: 'mod1', name: 'vm', path: 'group/vm' }]),
    ),
  } satisfies ApiStub<ModulesService>;
  const view = await renderComponent(AdminModulesComponent, {
    declarations: [ModuleListStub],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ModulesService, useValue: modulesApi },
    ],
  });
  const list: ModuleListStub = view.fixture.debugElement.query(
    By.directive(ModuleListStub),
  ).componentInstance;
  return { ...view, list, modulesApi };
}

describe('AdminModulesComponent', () => {
  /**
   * Verifies: the page loads the modules with version counts and passes them, with loading cleared, to the list.
   * Interacts with: ModulesService.getAllModules (stub), real ModuleService and ModuleQuery.
   * Data: one module; no permissions.
   */
  it('loads the modules into the list', async () => {
    const { list, modulesApi } = await renderModules({});

    expect(modulesApi.getAllModules).toHaveBeenCalledWith(false, true);
    expect(list.modules.map((m) => m.id)).toEqual(['mod1']);
    expect(list.isLoading).toBe(false);
  });

  /**
   * Verifies: the ManageWorkspaces system permission makes the module list editable (current behavior).
   * Interacts with: PermissionService.hasPermission (real), the list stub's canEdit input.
   * Data: system permission ManageWorkspaces.
   */
  it('passes canEdit true with ManageWorkspaces', async () => {
    const { list } = await renderModules({
      system: [SystemPermission.ManageWorkspaces],
    });

    expect(list.canEdit).toBe(true);
  });

  /**
   * Verifies: without ManageWorkspaces the module list is read-only, also for a user who holds ManageModules (current behavior).
   * Interacts with: PermissionService.hasPermission (real), the list stub's canEdit input.
   * Data: near misses: ViewWorkspaces, and ManageModules plus ViewModules.
   */
  it.each([
    { label: 'ViewWorkspaces', system: [SystemPermission.ViewWorkspaces] },
    {
      label: 'ManageModules',
      system: [SystemPermission.ManageModules, SystemPermission.ViewModules],
    },
  ])('passes canEdit false with $label only', async ({ system }) => {
    const { list } = await renderModules({ system });

    // Current behavior; see agent-docs/ui-test-bugs/caster.ui.md.
    expect(list.canEdit).toBe(false);
  });
});
