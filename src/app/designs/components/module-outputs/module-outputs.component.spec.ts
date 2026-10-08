// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ModuleOutput } from 'src/app/generated/caster-api';
import { renderComponent } from '../../../test-utils/render-component';
import { ModuleOutputsComponent } from './module-outputs.component';

@Component({ selector: 'cas-module-output', template: '', standalone: false })
class ModuleOutputStub {
  @Input() moduleName: string;
  @Input() output: ModuleOutput;
}

describe('ModuleOutputsComponent', () => {
  /**
   * Verifies: one output row renders per module output, each with the module name.
   * Interacts with: the cas-module-output stub's inputs.
   * Data: module web with outputs ip and id.
   */
  it('renders one row per output', async () => {
    const outputs: ModuleOutput[] = [{ name: 'ip' }, { name: 'id' }];
    const { fixture } = await renderComponent(ModuleOutputsComponent, {
      declarations: [ModuleOutputStub],
      inputs: { moduleName: 'web', outputs },
    });

    const rows: ModuleOutputStub[] = fixture.debugElement
      .queryAll(By.directive(ModuleOutputStub))
      .map((d) => d.componentInstance);
    expect(rows.map((r) => [r.moduleName, r.output.name])).toEqual([
      ['web', 'ip'],
      ['web', 'id'],
    ]);
  });
});
