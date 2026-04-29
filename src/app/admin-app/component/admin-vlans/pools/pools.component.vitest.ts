// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { Pool } from 'src/app/generated/caster-api';
import { PoolQuery } from 'src/app/vlans/state/pool/pool.query';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { PoolsComponent } from './pools.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderPools() {
  const load = vi.fn(() => of([]));
  const selectEntity = vi.fn(() => of({} as Pool));
  const rendered = await renderComponent(PoolsComponent, {
    declarations: [PoolsComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { canEdit: true },
    providers: [
      { provide: PoolService, useValue: { load } },
      { provide: PoolQuery, useValue: { selectAll: () => of([]), selectEntity } },
    ],
  });
  return { ...rendered, load, selectEntity };
}

describe('PoolsComponent', () => {
  it('creates and loads pools on init', async () => {
    const { fixture, load } = await renderPools();
    expect(fixture.componentInstance).toBeTruthy();
    expect(load).toHaveBeenCalled();
  });

  it('selectPool hides the list and selects the pool', async () => {
    const { fixture, selectEntity } = await renderPools();
    fixture.componentInstance.selectPool({ id: 'p1' } as Pool);
    expect(fixture.componentInstance.showPools).toBe(false);
    expect(selectEntity).toHaveBeenCalledWith('p1');
  });

  it('deselectPool shows the list again', async () => {
    const { fixture } = await renderPools();
    fixture.componentInstance.selectPool({ id: 'p1' } as Pool);
    fixture.componentInstance.deselectPool();
    expect(fixture.componentInstance.showPools).toBe(true);
  });
});
