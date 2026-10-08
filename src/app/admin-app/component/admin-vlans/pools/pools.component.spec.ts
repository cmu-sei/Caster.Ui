// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Pool, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PoolsComponent } from './pools.component';

@Component({ selector: 'cas-pool-list', template: '', standalone: false })
class PoolListStub {
  @Input() pools: Pool[];
  @Input() canEdit: boolean;
  @Output() poolSelected = new EventEmitter<Pool>();
}

@Component({ selector: 'cas-partition-list', template: '', standalone: false })
class PartitionListStub {
  @Input() poolId: string;
  @Input() canEdit: boolean;
}

async function renderPools(canEdit: boolean) {
  const vlansApi = {
    getPools: vi.fn(() => of<Pool[]>([{ id: 'pool1', name: 'Main' }])),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(PoolsComponent, {
    declarations: [PoolListStub, PartitionListStub],
    imports: [MatButtonModule, MatIconModule],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { canEdit },
  });
  return { ...view, user: userEvent.setup() };
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
    expect(list?.pools.map((p) => p.id)).toEqual(['pool1']);
    expect(list?.canEdit).toBe(true);
  });

  /**
   * Verifies: selecting a pool shows its partitions with the same canEdit, and Back returns to the pool list.
   * Interacts with: the pool-list stub's poolSelected output, the partition-list stub.
   * Data: pool Main selected; canEdit true.
   */
  it('opens the partitions of the selected pool', async () => {
    const { fixture, user } = await renderPools(true);

    stubOf(fixture, PoolListStub)?.poolSelected.emit({
      id: 'pool1',
      name: 'Main',
    });
    fixture.detectChanges();
    expect(screen.getByRole('heading', { name: 'Pool - Main' })).toBeVisible();
    const partitions = stubOf(fixture, PartitionListStub);
    expect(partitions?.poolId).toBe('pool1');
    expect(partitions?.canEdit).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Back to pools' }));
    expect(stubOf(fixture, PoolListStub)).toBeDefined();
    expect(stubOf(fixture, PartitionListStub)).toBeUndefined();
  });

  /**
   * Verifies: canEdit false reaches the pool list, and the partitions of a selected pool.
   * Interacts with: the pool-list and partition-list stubs' canEdit inputs.
   * Data: canEdit false; pool Main selected.
   */
  it('passes canEdit false to the pool list and partitions', async () => {
    const { fixture } = await renderPools(false);

    expect(stubOf(fixture, PoolListStub)?.canEdit).toBe(false);
    stubOf(fixture, PoolListStub)?.poolSelected.emit({
      id: 'pool1',
      name: 'Main',
    });
    fixture.detectChanges();
    expect(stubOf(fixture, PartitionListStub)?.canEdit).toBe(false);
  });
});
