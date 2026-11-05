// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Pool, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PoolsComponent } from './pools.component';
import { PoolListComponent } from 'src/app/admin-app/component/admin-vlans/pool-list/pool-list.component';

@Component({ selector: 'cas-pool-list', template: '' })
class PoolListStub {
  readonly pools = input<Pool[]>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly isLoading = input<boolean>(undefined);
}

async function renderPools(canEdit: boolean) {
  const vlansApi = {
    getPools: vi.fn(() => of<Pool[]>([{ id: 'pool1', name: 'Main' }])),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(PoolsComponent, {
    childStubs: [
      { replace: PoolListComponent, with: PoolListStub },
    ],
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { canEdit },
  });
  return view;
}

function stubOf<T>(
  fixture: Awaited<ReturnType<typeof renderPools>>['fixture'],
  type: new (...args: never[]) => T,
): T | undefined {
  return fixture.debugElement.query(By.directive(type))?.componentInstance;
}

describe('PoolsComponent', () => {
  /**
   * Verifies: the pools load into the pool list, and canEdit true reaches it.
   * Interacts with: VlansService.getPools (stub), real PoolService and PoolQuery, the pool-list stub.
   * Data: pool Main; canEdit true.
   */
  it('passes the pools and canEdit true to the pool list', async () => {
    const { fixture } = await renderPools(true);

    const list = stubOf(fixture, PoolListStub);
    expect(list?.pools().map((p) => p.id)).toEqual(['pool1']);
    expect(list?.canEdit()).toBe(true);
    expect(list?.isLoading()).toBe(false);
  });

  /**
   * Verifies: canEdit false reaches the pool list.
   * Interacts with: the pool-list stub's canEdit input.
   * Data: pool Main; canEdit false.
   */
  it('passes canEdit false to the pool list', async () => {
    const { fixture } = await renderPools(false);

    expect(stubOf(fixture, PoolListStub)?.canEdit()).toBe(false);
  });
});
