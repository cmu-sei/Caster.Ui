// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Run } from 'src/app/generated/caster-api';
import { ActiveRunsComponent } from './active-runs.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const run: Run = { id: 'r1', workspaceId: 'w1' } as Run;

async function renderRuns() {
  return renderComponent(ActiveRunsComponent, {
    declarations: [ActiveRunsComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { runs: [run], expandedRuns: [] },
  });
}

describe('ActiveRunsComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderRuns();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('expand() emits expandRun with the given payload', async () => {
    const { fixture } = await renderRuns();
    const spy = vi.fn();
    fixture.componentInstance.expandRun.subscribe(spy);
    fixture.componentInstance.expand({ expand: true, item: run });
    expect(spy).toHaveBeenCalledWith({ expand: true, item: run });
  });

  it('planOutput() emits planUpdated', async () => {
    const { fixture } = await renderRuns();
    const spy = vi.fn();
    fixture.componentInstance.planUpdated.subscribe(spy);
    fixture.componentInstance.planOutput('log', run);
    expect(spy).toHaveBeenCalledWith({ output: 'log', item: run });
  });

  it('applyOutput() emits applyUpdated', async () => {
    const { fixture } = await renderRuns();
    const spy = vi.fn();
    fixture.componentInstance.applyUpdated.subscribe(spy);
    fixture.componentInstance.applyOutput('log', run);
    expect(spy).toHaveBeenCalledWith({ output: 'log', item: run });
  });
});
