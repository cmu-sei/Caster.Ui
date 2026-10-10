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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Pool, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PoolListComponent } from './pool-list.component';

@Component({ selector: 'cas-pool-list-item', template: '', standalone: false })
class PoolListItemStub {
  @Input() pool: Pool;
  @Input() canEdit: boolean;
  @Output() poolSelected = new EventEmitter<Pool>();
}

const pools: Pool[] = [
  { id: 'pool1', name: 'Main' },
  { id: 'pool2', name: 'Lab' },
];

async function renderPoolList(canEdit: boolean) {
  const vlansApi = {
    createPool: vi.fn(() => of<Pool>({ id: 'pool3', name: 'New Pool' })),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(PoolListComponent, {
    declarations: [PoolListItemStub],
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { pools, canEdit },
  });
  const items = (): PoolListItemStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(PoolListItemStub))
      .map((d) => d.componentInstance);
  return { ...view, vlansApi, items, user: userEvent.setup() };
}

describe('PoolListComponent', () => {
  /**
   * Verifies: with canEdit, Create a Pool creates a pool through the API, and every item gets canEdit true.
   * Interacts with: VlansService.createPool (stub), real PoolService, the item stubs' canEdit inputs.
   * Data: pools Main and Lab; canEdit true.
   */
  it('creates a pool when canEdit is true', async () => {
    const { vlansApi, items, user } = await renderPoolList(true);

    expect(items().map((i) => i.canEdit)).toEqual([true, true]);
    await user.click(screen.getByRole('button', { name: 'Create a Pool' }));

    expect(vlansApi.createPool).toHaveBeenCalledWith({ name: 'New Pool' });
  });

  /**
   * Verifies: without canEdit there is no Create a Pool button and every item gets canEdit false.
   * Interacts with: the @if (canEdit) block, the item stubs' canEdit inputs.
   * Data: pools Main and Lab; canEdit false.
   */
  it('hides Create a Pool when canEdit is false', async () => {
    const { items } = await renderPoolList(false);

    expect(
      screen.queryByRole('button', { name: 'Create a Pool' }),
    ).not.toBeInTheDocument();
    expect(items().map((i) => i.canEdit)).toEqual([false, false]);
  });

  /**
   * Verifies: View Documentation toggles the pool documentation, and an item's selection is re-emitted.
   * Interacts with: the poolSelected output.
   * Data: canEdit false; the Lab item selected.
   */
  it('toggles the documentation and forwards a selected pool', async () => {
    const poolSelected = vi.fn<(pool: Pool) => void>();
    const { fixture, items, user } = await renderPoolList(false);
    fixture.componentInstance.poolSelected.subscribe(poolSelected);

    await user.click(
      screen.getByRole('button', { name: 'View Documentation' }),
    );
    expect(screen.getByText(/Pools are groups of 4096 VLANs/)).toBeVisible();

    items()[1].poolSelected.emit(pools[1]);
    expect(poolSelected).toHaveBeenCalledWith(pools[1]);
  });
});
