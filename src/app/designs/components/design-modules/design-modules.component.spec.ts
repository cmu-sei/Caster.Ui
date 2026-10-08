// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import {
  DesignModule,
  DesignsModulesService,
  Module,
  ModulesService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DesignModulesComponent } from './design-modules.component';

@Component({ selector: 'cas-module-list', template: '', standalone: false })
class ModuleListStub {
  @Input() modules: Module[];
  @Input() isEditing: boolean;
  @Output() getModule = new EventEmitter<{ id: string; name: string }>();
}

@Component({ selector: 'cas-design-module', template: '', standalone: false })
class DesignModuleStub {
  @Input() designModule: DesignModule;
  @Input() module: Module;
  @Input() canEdit: boolean;
}

async function renderDesignModules(canEdit: boolean) {
  const modulesApi = {
    getAllModules: vi.fn(() =>
      of<Module[]>([{ id: 'mod1', name: 'web server', path: 'g/web' }]),
    ),
  } satisfies ApiStub<ModulesService>;
  const designModulesApi = {
    getDesignModulesByDesign: vi.fn((designId: string) =>
      of<DesignModule[]>([
        { id: 'dm1', designId, moduleId: 'mod1', name: 'web', values: [] },
      ]),
    ),
    createDesignModule: vi.fn(() =>
      of<DesignModule>({
        id: 'dm2',
        designId: 'd1',
        moduleId: 'mod1',
        name: 'web_server',
        values: [],
      }),
    ),
  } satisfies ApiStub<DesignsModulesService>;
  const view = await renderComponent(DesignModulesComponent, {
    declarations: [ModuleListStub, DesignModuleStub],
    imports: [MatButtonModule],
    providers: [
      { provide: ModulesService, useValue: modulesApi },
      { provide: DesignsModulesService, useValue: designModulesApi },
    ],
    inputs: { designId: 'd1', canEdit },
  });
  const designModules = (): DesignModuleStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(DesignModuleStub))
      .map((d) => d.componentInstance);
  return { ...view, designModulesApi, designModules, user: userEvent.setup() };
}

describe('DesignModulesComponent', () => {
  /**
   * Verifies: with canEdit, Add Module opens the module list, and picking a module adds it to the design with spaces in its name replaced.
   * Interacts with: ModulesService.getAllModules and DesignsModulesService (stubs), real ModuleService and DesignModuleService.
   * Data: design d1 with module web; module "web server" picked; canEdit true.
   */
  it('adds a module to the design when canEdit is true', async () => {
    const { fixture, designModulesApi, designModules, user } =
      await renderDesignModules(true);

    expect(designModules().map((d) => d.canEdit)).toEqual([true]);
    await user.click(screen.getByRole('button', { name: 'Add Module' }));
    fixture.debugElement
      .query(By.directive(ModuleListStub))
      .componentInstance.getModule.emit({ id: 'mod1', name: 'web server' });

    expect(designModulesApi.createDesignModule).toHaveBeenCalledWith({
      designId: 'd1',
      moduleId: 'mod1',
      name: 'web_server',
      values: [],
    });
  });

  /**
   * Verifies: without canEdit Add Module is disabled and every design module gets canEdit false.
   * Interacts with: the [disabled]="!canEdit" binding, the design-module stubs' canEdit inputs.
   * Data: design d1 with module web; canEdit false.
   */
  it('disables Add Module when canEdit is false', async () => {
    const { designModules } = await renderDesignModules(false);

    expect(screen.getByRole('button', { name: 'Add Module' })).toBeDisabled();
    expect(designModules().map((d) => d.canEdit)).toEqual([false]);
  });
});
