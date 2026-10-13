// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import {
  Component,
  EventEmitter,
  getDebugNode,
  Input,
  Output,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of, Subject } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { ModuleVariablesResult } from 'src/app/editor/component/module-variables/module-variables.models';
import {
  DesignModule,
  DesignsModulesService,
  Module,
  ModulesService,
  Variable,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  captureUnhandledRxErrors,
  flush,
} from 'src/app/test-utils/unhandled-rx-errors';
import { VariablesStore } from '../../state/variables/variables.store';
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

@Component({
  selector: 'cas-module-variables',
  template: '',
  standalone: false,
})
class ModuleVariablesStub {
  @Input() selectedModule: Module;
  @Input() name: string;
  @Input() readOnly: boolean;
  @Input() variables: Variable[];
  @Input() outputs: unknown[];
  @Input() isSaving: boolean;
  @Input() requireChanges: boolean;
  @Input() requireValues: boolean;
  @Input() submitButtonText: string;
  @Output() variablesSelected = new EventEmitter<ModuleVariablesResult>();
}

const pickedModule: Module = {
  id: 'mod1',
  name: 'web server',
  path: 'g/web',
  versions: [
    { id: 'ver2', name: 'v2', outputs: [] },
    { id: 'ver1', name: 'v1', outputs: [{ name: 'ip' }] },
  ],
};

interface Setup {
  canEdit: boolean;
  stored?: DesignModule[];
  picked?: Module;
  create?: () => Observable<DesignModule>;
}

async function renderDesignModules({
  canEdit,
  stored = [
    {
      id: 'dm1',
      designId: 'd1',
      moduleId: 'mod1',
      name: 'web',
      moduleVersion: 'v1',
      values: [],
    },
  ],
  picked = pickedModule,
  create = () =>
    of<DesignModule>({
      id: 'dm2',
      designId: 'd1',
      moduleId: 'mod1',
      name: 'web_server',
      values: [],
    }),
}: Setup) {
  const modulesApi = {
    getAllModules: vi.fn(() =>
      of<Module[]>([{ id: 'mod1', name: 'web server', path: 'g/web' }]),
    ),
    getModule: vi.fn((_id: string) => of<Module>(structuredClone(picked))),
  } satisfies ApiStub<ModulesService>;
  const designModulesApi = {
    getDesignModulesByDesign: vi.fn((_designId: string) =>
      of<DesignModule[]>(structuredClone(stored)),
    ),
    createDesignModule: vi.fn(create),
  } satisfies ApiStub<DesignsModulesService>;
  const view = await renderComponent(DesignModulesComponent, {
    declarations: [ModuleListStub, DesignModuleStub, ModuleVariablesStub],
    imports: [MatButtonModule, MatDialogModule],
    providers: [
      { provide: ModulesService, useValue: modulesApi },
      { provide: DesignsModulesService, useValue: designModulesApi },
    ],
    inputs: { designId: 'd1', canEdit },
  });
  TestBed.inject(VariablesStore).set([
    { id: 'v1', designId: 'd1', name: 'region', terraform: 'var.region' },
    { id: 'v9', designId: 'd9', name: 'other', terraform: 'var.other' },
  ]);
  const designModules = (): DesignModuleStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(DesignModuleStub))
      .map((d) => d.componentInstance);
  const moduleList = (): ModuleListStub | undefined =>
    view.fixture.debugElement.query(By.directive(ModuleListStub))
      ?.componentInstance;
  // The add dialog renders in the overlay, outside the fixture's debug tree.
  const addDialog = (): ModuleVariablesStub | undefined => {
    const element = document.querySelector('cas-module-variables');
    return element ? getDebugNode(element)?.componentInstance : undefined;
  };
  const user = userEvent.setup();
  // Add Module, then pick the module from the list.
  const pickModule = async () => {
    await user.click(screen.getByRole('button', { name: 'Add Module' }));
    moduleList()?.getModule.emit({ id: 'mod1', name: 'web server' });
    await view.fixture.whenStable();
  };
  return {
    ...view,
    modulesApi,
    designModulesApi,
    designModules,
    moduleList,
    addDialog,
    pickModule,
    user,
  };
}

const addResult: ModuleVariablesResult = {
  versionId: 'ver2',
  moduleName: 'web_server',
  versionName: 'v2',
  variableValues: [
    { name: 'size', value: 'large' },
    { name: 'zone', value: '' },
    { name: 'region', value: 'east' },
  ],
  changedVariables: ['size', 'zone'],
};

describe('DesignModulesComponent', () => {
  /**
   * Verifies: with canEdit, Add Module opens the module list; picking a module loads it and opens its variables for Add with a Terraform-safe default name and the design's variables and module outputs to pick from; Add creates the design module with the chosen version and only the changed, non-blank values, then closes the dialog and the list.
   * Interacts with: ModulesService.getAllModules and getModule, DesignsModulesService (stubs), real ModuleService, DesignModuleService and MatDialog, the module-variables stub's inputs and variablesSelected output.
   * Data: design d1 with module web (version v1, output ip) and variable region, plus variable other of design d9; module "web server" (versions v2, v1) picked; size changed to large, zone cleared, region unchanged; canEdit true.
   */
  it('adds a module to the design when canEdit is true', async () => {
    const {
      fixture,
      modulesApi,
      designModulesApi,
      designModules,
      moduleList,
      addDialog,
      pickModule,
    } = await renderDesignModules({ canEdit: true });

    expect(designModules().map((d) => d.canEdit)).toEqual([true]);
    await pickModule();

    expect(modulesApi.getModule).toHaveBeenCalledWith('mod1');
    expect(designModulesApi.createDesignModule).not.toHaveBeenCalled();
    const dialog = addDialog();
    expect({
      selectedModule: dialog?.selectedModule,
      name: dialog?.name,
      readOnly: dialog?.readOnly,
      requireChanges: dialog?.requireChanges,
      requireValues: dialog?.requireValues,
      submitButtonText: dialog?.submitButtonText,
    }).toEqual({
      selectedModule: pickedModule,
      name: 'web_server',
      readOnly: false,
      requireChanges: false,
      requireValues: true,
      submitButtonText: 'Add',
    });
    expect(dialog?.variables).toEqual([
      { id: 'v1', designId: 'd1', name: 'region', terraform: 'var.region' },
    ]);
    expect(dialog?.outputs).toEqual([
      {
        designModuleName: 'web',
        name: 'ip',
        terraform: '${module.web.ip}',
      },
    ]);

    dialog?.variablesSelected.emit(addResult);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(designModulesApi.createDesignModule).toHaveBeenCalledWith({
      designId: 'd1',
      moduleId: 'mod1',
      name: 'web_server',
      moduleVersion: 'v2',
      values: [{ name: 'size', value: 'large' }],
    });
    expect(addDialog()).toBeUndefined();
    expect(moduleList()).toBeUndefined();
    expect(designModules()).toHaveLength(1);
  });

  /**
   * Verifies: the default name is numbered when a module of this design already has it, and names in other designs are ignored.
   * Interacts with: the real DesignModuleQuery, the module-variables stub's name input.
   * Data: design d1 holds web_server; design d9 holds web_server_2; module "web server" picked; canEdit true.
   */
  it('numbers the default name when the design already uses it', async () => {
    const { addDialog, pickModule } = await renderDesignModules({
      canEdit: true,
      stored: [
        {
          id: 'dm1',
          designId: 'd1',
          moduleId: 'mod1',
          name: 'web_server',
          values: [],
        },
        {
          id: 'dm9',
          designId: 'd9',
          moduleId: 'mod1',
          name: 'web_server_2',
          values: [],
        },
      ],
    });

    await pickModule();

    expect(addDialog()?.name).toBe('web_server_2');
  });

  /**
   * Verifies: picking a module that has no versions opens no dialog and creates nothing.
   * Interacts with: ModulesService.getModule (stub), DesignsModulesService.createDesignModule (stub).
   * Data: module "web server" with no versions picked; canEdit true.
   */
  it('opens no add dialog for a module without versions', async () => {
    const { modulesApi, designModulesApi, moduleList, addDialog, pickModule } =
      await renderDesignModules({
        canEdit: true,
        picked: { ...pickedModule, versions: [] },
      });

    await pickModule();

    expect(modulesApi.getModule).toHaveBeenCalledWith('mod1');
    expect(addDialog()).toBeUndefined();
    expect(moduleList()).toBeDefined();
    expect(designModulesApi.createDesignModule).not.toHaveBeenCalled();
  });

  /**
   * Verifies: cancelling the add dialog closes it without creating a module and leaves the module list open.
   * Interacts with: the module-variables stub's variablesSelected output (null), DesignsModulesService.createDesignModule (stub).
   * Data: module "web server" picked, then cancelled; canEdit true.
   */
  it('closes the add dialog without adding when it is cancelled', async () => {
    const { fixture, designModulesApi, moduleList, addDialog, pickModule } =
      await renderDesignModules({ canEdit: true });

    await pickModule();
    expect(addDialog()).toBeDefined();
    addDialog()?.variablesSelected.emit(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(addDialog()).toBeUndefined();
    expect(moduleList()).toBeDefined();
    expect(designModulesApi.createDesignModule).not.toHaveBeenCalled();
  });

  /**
   * Verifies: the add dialog shows saving while the module is created, and a failed create clears it and keeps the dialog open while the error escapes to the app's ErrorHandler.
   * Interacts with: DesignsModulesService.createDesignModule (stub; a Subject the test fails), the module-variables stub's isSaving input, captureUnhandledRxErrors.
   * Data: module "web server" picked and added; the create request fails; canEdit true.
   */
  it('clears saving when adding the module fails', async () => {
    const errors = captureUnhandledRxErrors();
    const request = new Subject<DesignModule>();
    const { fixture, addDialog, pickModule } = await renderDesignModules({
      canEdit: true,
      create: () => request,
    });

    await pickModule();
    addDialog()?.variablesSelected.emit(addResult);
    await fixture.whenStable();
    expect(addDialog()?.isSaving).toBe(true);

    const failure = new Error('500');
    request.error(failure);
    await flush();
    await fixture.whenStable();

    expect(addDialog()?.isSaving).toBe(false);
    // Escapes to the app's ErrorHandler (ErrorService), which shows it.
    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: when canEdit turns false while the module list is open, the list's Close button is disabled and a module picked from it opens its variables read-only, so it cannot be added.
   * Interacts with: the [readOnly]="!canEdit" binding on the add dialog, the module-variables stub's readOnly input, the real MatDialog.
   * Data: canEdit true, Add Module clicked, then canEdit set false (the live canEdit$ of the project); module "web server" picked.
   */
  it('opens the add dialog read-only when canEdit turns false', async () => {
    const { fixture, user, moduleList, addDialog } =
      await renderDesignModules({ canEdit: true });

    await user.click(screen.getByRole('button', { name: 'Add Module' }));
    fixture.componentRef.setInput('canEdit', false);
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    moduleList()?.getModule.emit({ id: 'mod1', name: 'web server' });
    await fixture.whenStable();

    expect(addDialog()).toBeDefined();
    expect(addDialog()?.readOnly).toBe(true);
  });

  /**
   * Verifies: without canEdit Add Module is disabled and every design module gets canEdit false.
   * Interacts with: the [disabled]="!canEdit" binding, the design-module stubs' canEdit inputs.
   * Data: design d1 with module web; canEdit false.
   */
  it('disables Add Module when canEdit is false', async () => {
    const { designModules } = await renderDesignModules({ canEdit: false });

    expect(screen.getByRole('button', { name: 'Add Module' })).toBeDisabled();
    expect(designModules().map((d) => d.canEdit)).toEqual([false]);
  });
});
