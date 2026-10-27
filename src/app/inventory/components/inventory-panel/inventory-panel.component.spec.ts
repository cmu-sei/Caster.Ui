// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  INVENTORY_CATEGORIES,
  InventoryCategoryDescriptor,
  InventoryQuery,
  InventoryService,
} from '../../state';
import { InventoryListComponent } from '../inventory-list/inventory-list.component';
import { InventoryPanelComponent } from './inventory-panel.component';

@Component({ selector: 'cas-inventory-list', template: '' })
class InventoryListStub {
  readonly descriptor = input<InventoryCategoryDescriptor>(undefined);
}

describe('InventoryPanelComponent', () => {
  let component: InventoryPanelComponent;

  let filter$: BehaviorSubject<string>;
  let refreshing$: BehaviorSubject<boolean>;
  let inventoryServiceSpy: {
    loadAll: ReturnType<typeof vi.fn<InventoryService['loadAll']>>;
    refresh: ReturnType<typeof vi.fn<InventoryService['refresh']>>;
    setFilter: ReturnType<typeof vi.fn<InventoryService['setFilter']>>;
  };

  beforeEach(async () => {
    filter$ = new BehaviorSubject<string>('');
    refreshing$ = new BehaviorSubject<boolean>(false);

    // No live API in specs: the query and service are both stubbed.
    inventoryServiceSpy = {
      loadAll: vi.fn<InventoryService['loadAll']>(() => of([])),
      refresh: vi.fn<InventoryService['refresh']>(() => of([])),
      setFilter: vi.fn<InventoryService['setFilter']>(),
    } satisfies Partial<InventoryService>;

    const { fixture } = await renderComponent(InventoryPanelComponent, {
      childStubs: [
        { replace: InventoryListComponent, with: InventoryListStub },
      ],
      imports: [
        MatButtonModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatListModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        ClipboardModule,
      ],
      providers: [
        {
          provide: InventoryQuery,
          useValue: {
            filter$,
            refreshing$,
            lastUpdated$: of(null),
            categories$: of(INVENTORY_CATEGORIES),
          },
        },
        { provide: InventoryService, useValue: inventoryServiceSpy },
      ],
    });
    component = fixture.componentInstance;
  });

  /**
   * Verifies: the panel renders.
   * Interacts with: InventoryQuery (filter$, refreshing$ subjects); InventoryService (stub).
   * Data: empty filter, not refreshing.
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Verifies: the panel shows VM templates, ISOs, networks, datastores and the content library, in that order.
   * Interacts with: InventoryPanelComponent.categories$ from InventoryQuery (stub).
   * Data: every category applies.
   */
  it('lists every inventory category', async () => {
    const categories = await firstValueFrom(component.categories$);

    expect(categories.map((c) => c.category)).toEqual([
      'vmTemplates',
      'isos',
      'networks',
      'datastores',
      'contentLibrary',
    ]);
  });

  /**
   * Verifies: nothing loads until the panel is first opened, and reopening does not load again.
   * Interacts with: InventoryService.loadAll (stub); onExpanded, onCollapsed.
   * Data: open, close, open.
   */
  it('loads once, only after the panel is opened', () => {
    expect(inventoryServiceSpy.loadAll).not.toHaveBeenCalled();

    component.onExpanded();
    component.onCollapsed();
    component.onExpanded();

    expect(inventoryServiceSpy.loadAll).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: applyFilter passes the term to the service and clearFilter resets it to empty.
   * Interacts with: InventoryService.setFilter (stub).
   * Data: 'ubuntu', then cleared.
   */
  it('pushes and clears the search term', () => {
    component.applyFilter('ubuntu');
    expect(inventoryServiceSpy.setFilter).toHaveBeenCalledWith('ubuntu');

    component.clearFilter();
    expect(component.filterString).toBe('');
    expect(inventoryServiceSpy.setFilter).toHaveBeenCalledWith('');
  });

  /**
   * Verifies: refresh asks the service to refresh the inventory once.
   * Interacts with: InventoryService.refresh (stub).
   * Data: none.
   */
  it('triggers a manual refresh', () => {
    component.refresh();
    expect(inventoryServiceSpy.refresh).toHaveBeenCalledTimes(1);
  });
});
