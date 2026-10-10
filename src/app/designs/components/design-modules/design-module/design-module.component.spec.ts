// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ModuleVariablesResult } from 'src/app/editor/component/module-variables/module-variables.models';
import {
  DesignModule,
  DesignsModulesService,
  Module,
  ModuleOutput,
  ModulesService,
  ModuleValue,
  Variable,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DesignModuleComponent } from './design-module.component';

@Component({
  selector: 'cas-module-variables',
  template: '',
  standalone: false,
})
class ModuleVariablesStub {
  @Input() selectedModule: Module;
  @Input() readOnly: boolean;
  @Input() values: ModuleValue[];
  @Input() name: string;
  @Input() selectedVersionName: string;
  @Input() variables: Variable[];
  @Input() outputs: unknown[];
  @Input() isSaving: boolean;
  @Output() variablesSelected = new EventEmitter<ModuleVariablesResult>();
}

@Component({ selector: 'cas-module-outputs', template: '', standalone: false })
class ModuleOutputsStub {
  @Input() moduleName: string;
  @Input() outputs: ModuleOutput[];
}

const designModule: DesignModule = {
  id: 'dm1',
  designId: 'd1',
  moduleId: 'mod1',
  name: 'web',
  enabled: true,
  moduleVersion: 'v1',
  values: [],
};
const module: Module = {
  id: 'mod1',
  name: 'web server',
  versions: [{ name: 'v1', outputs: [] }],
};

async function renderDesignModule(canEdit: boolean) {
  const designModulesApi = {
    getDesignModule: vi.fn((_id: string) =>
      of<DesignModule>(structuredClone(designModule)),
    ),
    disableDesignModule: vi.fn((_id: string) =>
      of<DesignModule>({ ...designModule, enabled: false }),
    ),
  } satisfies ApiStub<DesignsModulesService>;
  const modulesApi = {
    getModule: vi.fn((_id: string) => of<Module>(structuredClone(module))),
  } satisfies ApiStub<ModulesService>;
  const view = await renderComponent(DesignModuleComponent, {
    declarations: [ModuleVariablesStub, ModuleOutputsStub],
    imports: [MatCardModule, MatButtonModule, MatIconModule, MatTooltipModule],
    providers: [
      { provide: DesignsModulesService, useValue: designModulesApi },
      { provide: ModulesService, useValue: modulesApi },
    ],
    inputs: { designModule, module, canEdit },
  });
  const variablesEditor = (): ModuleVariablesStub | undefined =>
    view.fixture.debugElement.query(By.directive(ModuleVariablesStub))
      ?.componentInstance;
  return {
    ...view,
    designModulesApi,
    variablesEditor,
    user: userEvent.setup(),
  };
}

describe('DesignModuleComponent', () => {
  /**
   * Verifies: with canEdit, Delete and Disable are enabled, Disable calls the API, and Edit opens the variables editor writable.
   * Interacts with: DesignsModulesService.disableDesignModule, getDesignModule and ModulesService.getModule (stubs), the module-variables stub's readOnly input.
   * Data: enabled design module web; canEdit true.
   */
  it('lets an editor disable and edit the module when canEdit is true', async () => {
    const { designModulesApi, variablesEditor, user } =
      await renderDesignModule(true);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(designModulesApi.disableDesignModule).toHaveBeenCalledWith('dm1');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(variablesEditor()?.readOnly).toBe(false);
  });

  /**
   * Verifies: without canEdit, Delete and Disable are disabled, and Edit opens the variables editor read-only.
   * Interacts with: the [disabled]="!canEdit" bindings, the module-variables stub's readOnly input.
   * Data: enabled design module web; canEdit false.
   */
  it('shows the module read-only when canEdit is false', async () => {
    const { variablesEditor, user } = await renderDesignModule(false);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(variablesEditor()?.readOnly).toBe(true);
  });

  /**
   * Verifies: View Module Outputs loads the module and shows the outputs of the selected version.
   * Interacts with: ModulesService.getModule (stub), the module-outputs stub.
   * Data: module version v1 with no outputs; canEdit false.
   */
  it('shows the module outputs', async () => {
    const { fixture, user } = await renderDesignModule(false);

    await user.click(
      screen.getByRole('button', { name: 'View Module Outputs' }),
    );

    const outputs: ModuleOutputsStub = fixture.debugElement.query(
      By.directive(ModuleOutputsStub),
    ).componentInstance;
    expect(outputs.moduleName).toBe('web');
    expect(outputs.outputs).toEqual([]);
  });
});
