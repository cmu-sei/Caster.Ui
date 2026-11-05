// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Pool, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PoolListComponent } from './pool-list.component';
import { PoolListItemComponent } from 'src/app/admin-app/component/admin-vlans/pool-list-item/pool-list-item.component';

@Component({ selector: 'cas-pool-list-item', template: '' })
class PoolListItemStub {
  readonly pool = input<Pool>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly poolSelected = output<Pool>();
}

const pools: Pool[] = [
  { id: 'pool1', name: 'Main' },
  { id: 'pool2', name: 'Lab' },
];

async function renderPoolList(
  canEdit: boolean,
  { shownPools = pools, isLoading = false } = {},
) {
  const vlansApi = {
    createPool: vi.fn(() => of<Pool>({ id: 'pool3', name: 'New Pool' })),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(PoolListComponent, {
    childStubs: [{ replace: PoolListItemComponent, with: PoolListItemStub }],
    imports: [
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatCardModule,
      MatFormFieldModule,
      MatInputModule,
      MatProgressSpinnerModule,
    ],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { pools: shownPools, canEdit, isLoading },
  });
  const items = (): PoolListItemStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(PoolListItemStub))
      .map((d) => d.componentInstance);
  return { ...view, vlansApi, items, user: userEvent.setup() };
}

describe('PoolListComponent', () => {
  /**
   * Verifies: with canEdit, Add New Pool creates a pool through the API, and every item gets canEdit true.
   * Interacts with: VlansService.createPool (stub), real PoolService, the item stubs' canEdit inputs.
   * Data: pools Main and Lab; canEdit true.
   */
  it('creates a pool when canEdit is true', async () => {
    const { vlansApi, items, user } = await renderPoolList(true);

    expect(items().map((i) => i.canEdit())).toEqual([true, true]);
    await user.click(screen.getByRole('button', { name: 'Add New Pool' }));

    expect(vlansApi.createPool).toHaveBeenCalledWith({ name: 'New Pool' });
  });

  /**
   * Verifies: without canEdit Add New Pool is disabled (as Add on the other admin pages) and every item gets canEdit false.
   * Interacts with: the [disabled]="!canEdit" binding, the item stubs' canEdit inputs.
   * Data: pools Main and Lab; canEdit false.
   */
  it('disables Add New Pool when canEdit is false', async () => {
    const { vlansApi, items } = await renderPoolList(false);

    expect(screen.getByRole('button', { name: 'Add New Pool' })).toBeDisabled();
    expect(items().map((i) => i.canEdit())).toEqual([false, false]);
    expect(vlansApi.createPool).not.toHaveBeenCalled();
  });

  /**
   * Verifies: About pools carries the pool documentation as its tooltip (read as its description), and an item's selection is re-emitted.
   * Interacts with: MatTooltip on About pools, the poolSelected output.
   * Data: canEdit false; the Lab item selected.
   */
  it('explains pools and forwards a selected pool', async () => {
    const poolSelected = vi.fn<(pool: Pool) => void>();
    const { fixture, items } = await renderPoolList(false);
    fixture.componentInstance.poolSelected.subscribe(poolSelected);

    expect(
      screen.getByRole('button', { name: 'About pools' }),
    ).toHaveAccessibleDescription(/^Pools are groups of 4096 VLANs/);

    items()[1].poolSelected.emit(pools[1]);
    expect(poolSelected).toHaveBeenCalledWith(pools[1]);
  });

  /**
   * Verifies: Search narrows the pools by name, says when nothing matches, and Clear restores them.
   * Interacts with: the filterString signal and filteredPools.
   * Data: pools Main and Lab; searches "la" then "zz".
   */
  it('filters the pools by name', async () => {
    const { items, user } = await renderPoolList(true);
    const search = screen.getByPlaceholderText('Search');

    await user.type(search, 'la');
    expect(items().map((i) => i.pool().name)).toEqual(['Lab']);

    await user.type(search, 'zz');
    expect(items()).toEqual([]);
    expect(
      screen.getByText('No data matching the filter "lazz"'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(items().map((i) => i.pool().name)).toEqual(['Main', 'Lab']);
  });

  /**
   * Verifies: a spinner shows while the pools load, and an empty list says there are no Pools.
   * Interacts with: the isLoading input and the @empty block.
   * Data: no pools; isLoading true, then false.
   */
  it('shows a spinner while loading and an empty message after', async () => {
    const { fixture } = await renderPoolList(true, {
      shownPools: [],
      isLoading: true,
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(
      screen.queryByText('There are currently no Pools'),
    ).not.toBeInTheDocument();

    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('There are currently no Pools')).toBeVisible();
  });
});
