// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { Pool } from 'src/app/generated/caster-api';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { PoolListComponent } from './pool-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('PoolListComponent', () => {
  async function render() {
    const create = vi.fn(() => of({}));
    const rendered = await renderComponent(PoolListComponent, {
      declarations: [PoolListComponent],
      schemas: [NO_ERRORS_SCHEMA],
      componentProperties: { pools: [], canEdit: true },
      providers: [{ provide: PoolService, useValue: { create } }],
    });
    return { ...rendered, create };
  }

  it('creates the component', async () => {
    const { fixture } = await render();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('createPool() dispatches to PoolService.create', async () => {
    const { fixture, create } = await render();
    fixture.componentInstance.createPool();
    expect(create).toHaveBeenCalled();
  });

  it('selectPool() emits the pool on poolSelected', async () => {
    const { fixture } = await render();
    const spy = vi.fn();
    fixture.componentInstance.poolSelected.subscribe(spy);
    const p = { id: 'p1', name: 'Alpha' } as Pool;
    fixture.componentInstance.selectPool(p);
    expect(spy).toHaveBeenCalledWith(p);
  });

  it('toggleDocumentation() flips showDocumentation', async () => {
    const { fixture } = await render();
    expect(fixture.componentInstance.showDocumentation).toBe(false);
    fixture.componentInstance.toggleDocumentation();
    expect(fixture.componentInstance.showDocumentation).toBe(true);
    fixture.componentInstance.toggleDocumentation();
    expect(fixture.componentInstance.showDocumentation).toBe(false);
  });
});
