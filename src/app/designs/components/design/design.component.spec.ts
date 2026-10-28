// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Variable, VariablesService } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DesignStore } from '../../state/design.store';
import { DesignModuleStore } from '../../state/design-modules/design-module.store';
import { DesignComponent } from './design.component';
import { DesignModulesComponent } from 'src/app/designs/components/design-modules/design-modules.component';
import { VariablesComponent } from 'src/app/designs/components/variables/variables.component';

@Component({ selector: 'cas-variables', template: '' })
class VariablesStub {
  readonly designId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
}

@Component({ selector: 'cas-design-modules', template: '' })
class DesignModulesStub {
  readonly designId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
}

async function renderDesign(canEdit: boolean) {
  const variablesApi = {
    getVariablesByDesign: vi.fn((_designId: string) => of<Variable[]>([])),
  } satisfies ApiStub<VariablesService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinDesign: vi.fn(),
    leaveDesign: vi.fn(),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'joinDesign' | 'leaveDesign'
  >;
  const view = await renderComponent(DesignComponent, {
    childStubs: [
      { replace: VariablesComponent, with: VariablesStub },
      { replace: DesignModulesComponent, with: DesignModulesStub },
    ],
    imports: [MatExpansionModule, MatTooltipModule],
    providers: [
      { provide: VariablesService, useValue: variablesApi },
      { provide: SignalRService, useValue: signalR },
    ],
    inputs: { designId: 'd1', canEdit },
  });
  await view.fixture.whenStable();
  const stub = <T>(type: new (...args: never[]) => T): T =>
    view.fixture.debugElement.query(By.directive(type))?.componentInstance;
  return { ...view, variablesApi, signalR, stub, user: userEvent.setup() };
}

describe('DesignComponent', () => {
  /**
   * Verifies: the design joins its hub group, loads its variables, and shows Disabled for a disabled design.
   * Interacts with: SignalRService.joinDesign (stub), VariablesService.getVariablesByDesign (stub), real DesignQuery.
   * Data: design d1, disabled; canEdit true.
   */
  it('loads the design and flags it as disabled', async () => {
    const { fixture, variablesApi, signalR } = await renderDesign(true);
    TestBed.inject(DesignStore).set([
      { id: 'd1', name: 'Net', enabled: false },
    ]);
    fixture.detectChanges();

    expect(signalR.joinDesign).toHaveBeenCalledWith('d1');
    expect(variablesApi.getVariablesByDesign).toHaveBeenCalledWith('d1');
    expect(screen.getByRole('heading', { name: 'Disabled' })).toBeVisible();
  });

  /**
   * Verifies: an enabled module holding placeholders marks the design Incomplete and names each variable to
   * replace; a disabled module's placeholders do not count.
   * Interacts with: real DesignModuleQuery.getByDesignId.
   * Data: design d1, disabled; dc01 enabled with template_name and node_name placeholders, spare disabled.
   */
  it('flags the design incomplete while an enabled module holds placeholders', async () => {
    const { fixture } = await renderDesign(true);
    TestBed.inject(DesignStore).set([{ id: 'd1', name: 'Net', enabled: false }]);
    TestBed.inject(DesignModuleStore).set([
      { id: 'm1', designId: 'd1', name: 'dc01', enabled: true, placeholders: ['template_name', 'node_name'] },
      { id: 'm2', designId: 'd1', name: 'spare', enabled: false, placeholders: ['template_name'] },
      { id: 'm3', designId: 'd1', name: 'ws01', enabled: true, placeholders: [] },
    ]);
    fixture.detectChanges();

    expect(screen.getByRole('heading', { name: 'Incomplete' })).toBeVisible();
    expect(screen.getByText('dc01 (template_name, node_name)')).toBeVisible();
    expect(screen.queryByText(/^spare/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^ws01/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: canEdit true reaches the design modules and, once the Variables panel opens, the variables.
   * Interacts with: the design-modules and variables stubs' canEdit inputs.
   * Data: design d1; canEdit true; the Variables panel opened.
   */
  it('passes canEdit true to its modules and variables', async () => {
    const { stub, user } = await renderDesign(true);

    expect(stub(DesignModulesStub).canEdit()).toBe(true);
    await user.click(screen.getByRole('button', { name: /Variables/ }));
    expect(stub(VariablesStub).canEdit()).toBe(true);
  });

  /**
   * Verifies: canEdit false reaches the design modules and the variables, so neither offers editing.
   * Interacts with: the design-modules and variables stubs' canEdit inputs.
   * Data: design d1; canEdit false; the Variables panel opened.
   */
  it('passes canEdit false to its modules and variables', async () => {
    const { stub, user } = await renderDesign(false);

    expect(stub(DesignModulesStub).canEdit()).toBe(false);
    await user.click(screen.getByRole('button', { name: /Variables/ }));
    expect(stub(VariablesStub).canEdit()).toBe(false);
  });

  /**
   * Verifies: the design modules sit in a Modules panel that starts expanded, beside a collapsed Variables panel.
   * Interacts with: the two mat-expansion-panel headers, the design-modules stub's designId input.
   * Data: design d1; canEdit true.
   */
  it('shows the design modules in an expanded Modules panel', async () => {
    const { stub } = await renderDesign(true);

    expect(screen.getByRole('button', { name: /Modules/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /Variables/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(stub(DesignModulesStub).designId()).toBe('d1');
  });
});
