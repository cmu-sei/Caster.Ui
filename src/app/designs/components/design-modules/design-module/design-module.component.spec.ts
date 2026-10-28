// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ModuleVariablesResult } from 'src/app/editor/component/module-variables/module-variables.models';
import {
  DesignModule,
  DesignsModulesService,
  EditDesignModuleCommand,
  Module,
  ModuleOutput,
  ModulesService,
  ModuleValue,
  Variable,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  captureUnhandledRxErrors,
  flush,
} from 'src/app/test-utils/unhandled-rx-errors';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DesignModuleComponent } from './design-module.component';
import { ModuleOutputsComponent } from 'src/app/designs/components/module-outputs/module-outputs.component';
import { ModuleVariablesComponent } from 'src/app/editor/component/module-variables/module-variables.component';

@Component({
  selector: 'cas-module-variables',
  template: '',
})
class ModuleVariablesStub {
  readonly selectedModule = input<Module>(undefined);
  readonly readOnly = input<boolean>(undefined);
  readonly values = input<ModuleValue[]>(undefined);
  readonly name = input<string>(undefined);
  readonly selectedVersionName = input<string>(undefined);
  readonly variables = input<Variable[]>(undefined);
  readonly outputs = input<unknown[]>(undefined);
  readonly isSaving = input<boolean>(undefined);
  readonly requireValues = input<boolean>(undefined);
  readonly variablesSelected = output<ModuleVariablesResult>();
}

@Component({ selector: 'cas-module-outputs', template: '' })
class ModuleOutputsStub {
  readonly moduleName = input<string>(undefined);
  readonly outputs = input<ModuleOutput[]>(undefined);
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

async function renderDesignModule(
  canEdit: boolean,
  saveValues: () => Subject<DesignModule> = () => new Subject<DesignModule>(),
  saveEdit: () => Subject<DesignModule> = () => new Subject<DesignModule>(),
  shown: DesignModule = designModule,
) {
  const designModulesApi = {
    getDesignModule: vi.fn((_id: string) =>
      of<DesignModule>(structuredClone(designModule)),
    ),
    disableDesignModule: vi.fn((_id: string) =>
      of<DesignModule>({ ...designModule, enabled: false }),
    ),
    addOrUpdateValuesDesignModule: vi.fn(saveValues),
    editDesignModule: vi.fn((_id: string, _command?: EditDesignModuleCommand) =>
      saveEdit(),
    ),
  } satisfies ApiStub<DesignsModulesService>;
  const modulesApi = {
    getModule: vi.fn((_id: string) => of<Module>(structuredClone(module))),
  } satisfies ApiStub<ModulesService>;
  const view = await renderComponent(DesignModuleComponent, {
    childStubs: [
      { replace: ModuleVariablesComponent, with: ModuleVariablesStub },
      { replace: ModuleOutputsComponent, with: ModuleOutputsStub },
    ],
    imports: [MatCardModule, MatButtonModule, MatIconModule, MatTooltipModule],
    providers: [
      { provide: DesignsModulesService, useValue: designModulesApi },
      { provide: ModulesService, useValue: modulesApi },
    ],
    inputs: { designModule: shown, module, canEdit },
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
    expect(variablesEditor()?.readOnly()).toBe(false);
    expect(variablesEditor()?.requireValues()).toBe(true);
  });

  /**
   * Verifies: a module holding placeholders names the variables to replace; one without shows nothing.
   * Interacts with: DesignModule.placeholders.
   * Data: web with template_name and node_name placeholders, then web with none.
   */
  it('names the placeholders still to replace', async () => {
    await renderDesignModule(false, undefined, undefined, {
      ...designModule,
      placeholders: ['template_name', 'node_name'],
    });
    expect(screen.getByText('Placeholders: template_name, node_name')).toBeVisible();
  });

  it('shows no placeholders for a complete module', async () => {
    await renderDesignModule(false);
    expect(screen.queryByText(/^Placeholders:/)).not.toBeInTheDocument();
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
    expect(variablesEditor()?.readOnly()).toBe(true);
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
    expect(outputs.moduleName()).toBe('web');
    expect(outputs.outputs()).toEqual([]);
  });

  /**
   * Verifies: saving changed values shows saving on the variables editor until the request ends, and a failed save clears it while the error escapes to the app's ErrorHandler.
   * Interacts with: DesignsModulesService.addOrUpdateValuesDesignModule (stub; a Subject the test fails), the module-variables stub's isSaving input and variablesSelected output, captureUnhandledRxErrors.
   * Data: design module web, name and version unchanged, variable size changed; canEdit true.
   */
  it('clears saving when saving the values fails', async () => {
    const errors = captureUnhandledRxErrors();
    const request = new Subject<DesignModule>();
    const { fixture, designModulesApi, variablesEditor, user } =
      await renderDesignModule(true, () => request);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    variablesEditor()?.variablesSelected.emit({
      versionId: 'ver1',
      moduleName: 'web',
      versionName: 'v1',
      variableValues: [
        { name: 'size', value: 'large' },
        { name: 'zone', value: 'east' },
      ],
      changedVariables: ['size'],
    });
    fixture.detectChanges();

    expect(designModulesApi.addOrUpdateValuesDesignModule).toHaveBeenCalledWith(
      'dm1',
      { values: [{ name: 'size', value: 'large' }] },
    );
    expect(variablesEditor()?.isSaving()).toBe(true);

    const failure = new Error('500');
    request.error(failure);
    await flush();
    fixture.detectChanges();

    expect(variablesEditor()?.isSaving()).toBe(false);
    // Escapes to the app's ErrorHandler (ErrorService), which shows it.
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: when the name or the version changed, saving sends editDesignModule exactly the module id, the version, the name and only the changed values (no design id), not addOrUpdateValues, and shows saving on the variables editor until the request completes.
   * Interacts with: DesignsModulesService.editDesignModule and addOrUpdateValuesDesignModule (stubs; edit is a Subject the test completes), the module-variables stub's isSaving input and variablesSelected output.
   * Data: design module web (design d1, module mod1, version v1); renamed to web_renamed at v1, or kept as web at v2; size changed, zone unchanged; canEdit true.
   */
  it.each([
    { label: 'a new name', moduleName: 'web_renamed', versionName: 'v1' },
    { label: 'a new version', moduleName: 'web', versionName: 'v2' },
  ])(
    'edits the design module with $label',
    async ({ moduleName, versionName }) => {
      const request = new Subject<DesignModule>();
      const { fixture, designModulesApi, variablesEditor, user } =
        await renderDesignModule(true, undefined, () => request);

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      variablesEditor()?.variablesSelected.emit({
        versionId: 'ver1',
        moduleName,
        versionName,
        variableValues: [
          { name: 'size', value: 'large' },
          { name: 'zone', value: 'east' },
        ],
        changedVariables: ['size'],
      });
      fixture.detectChanges();

      expect(designModulesApi.editDesignModule).toHaveBeenCalledTimes(1);
      expect(designModulesApi.editDesignModule.mock.calls[0]).toStrictEqual([
        'dm1',
        {
          moduleId: 'mod1',
          moduleVersion: versionName,
          name: moduleName,
          values: [{ name: 'size', value: 'large' }],
        },
      ]);
      expect(
        designModulesApi.addOrUpdateValuesDesignModule,
      ).not.toHaveBeenCalled();
      expect(variablesEditor()?.isSaving()).toBe(true);

      request.next({ ...designModule, name: moduleName });
      request.complete();
      fixture.detectChanges();

      expect(variablesEditor()?.isSaving()).toBe(false);
    },
  );
});
