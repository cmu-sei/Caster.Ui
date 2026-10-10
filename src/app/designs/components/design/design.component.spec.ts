// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
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
import { DesignComponent } from './design.component';

@Component({ selector: 'cas-variables', template: '', standalone: false })
class VariablesStub {
  @Input() designId: string;
  @Input() canEdit: boolean;
}

@Component({ selector: 'cas-design-modules', template: '', standalone: false })
class DesignModulesStub {
  @Input() designId: string;
  @Input() canEdit: boolean;
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
    declarations: [VariablesStub, DesignModulesStub],
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
   * Verifies: canEdit true reaches the design modules and, once the Variables panel opens, the variables.
   * Interacts with: the design-modules and variables stubs' canEdit inputs.
   * Data: design d1; canEdit true; the Variables panel opened.
   */
  it('passes canEdit true to its modules and variables', async () => {
    const { stub, user } = await renderDesign(true);

    expect(stub(DesignModulesStub).canEdit).toBe(true);
    await user.click(screen.getByRole('button', { name: /Variables/ }));
    expect(stub(VariablesStub).canEdit).toBe(true);
  });

  /**
   * Verifies: canEdit false reaches the design modules and the variables, so neither offers editing.
   * Interacts with: the design-modules and variables stubs' canEdit inputs.
   * Data: design d1; canEdit false; the Variables panel opened.
   */
  it('passes canEdit false to its modules and variables', async () => {
    const { stub, user } = await renderDesign(false);

    expect(stub(DesignModulesStub).canEdit).toBe(false);
    await user.click(screen.getByRole('button', { name: /Variables/ }));
    expect(stub(VariablesStub).canEdit).toBe(false);
  });
});
