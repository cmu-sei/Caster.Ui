// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { Variable, VariablesService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VariablesStore } from '../../state/variables/variables.store';
import { VariablesComponent } from './variables.component';

@Component({ selector: 'cas-variable', template: '', standalone: false })
class VariableStub {
  @Input() variable: Variable;
  @Input() canEdit: boolean;
}

async function renderVariables(canEdit: boolean) {
  const variablesApi = {
    createVariable: vi.fn(() =>
      of<Variable>({ id: 'v2', designId: 'd1', name: 'New Variable' }),
    ),
  } satisfies ApiStub<VariablesService>;
  const view = await renderComponent(VariablesComponent, {
    declarations: [VariableStub],
    imports: [MatButtonModule],
    providers: [{ provide: VariablesService, useValue: variablesApi }],
    inputs: { designId: 'd1', canEdit },
  });
  TestBed.inject(VariablesStore).set([
    { id: 'v1', designId: 'd1', name: 'region' },
    { id: 'v9', designId: 'd9', name: 'other' },
  ]);
  view.fixture.detectChanges();
  const variables = (): VariableStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(VariableStub))
      .map((d) => d.componentInstance);
  return { ...view, variablesApi, variables, user: userEvent.setup() };
}

describe('VariablesComponent', () => {
  /**
   * Verifies: with canEdit the design's variables are listed editable, and Add creates a new variable for the design.
   * Interacts with: VariablesService.createVariable (stub), real VariablesQuery, the variable stubs' canEdit inputs.
   * Data: design d1 with variable region, plus variable other of design d9; canEdit true.
   */
  it('adds a variable when canEdit is true', async () => {
    const { variablesApi, variables, user } = await renderVariables(true);

    expect(variables().map((v) => [v.variable.name, v.canEdit])).toEqual([
      ['region', true],
    ]);
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(variablesApi.createVariable).toHaveBeenCalledWith({
      designId: 'd1',
      name: 'New Variable',
    });
  });

  /**
   * Verifies: without canEdit Add is disabled and every variable gets canEdit false.
   * Interacts with: the [disabled]="!canEdit" binding, the variable stubs' canEdit inputs.
   * Data: design d1 with variable region; canEdit false.
   */
  it('disables Add when canEdit is false', async () => {
    const { variables } = await renderVariables(false);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(variables().map((v) => v.canEdit)).toEqual([false]);
  });
});
