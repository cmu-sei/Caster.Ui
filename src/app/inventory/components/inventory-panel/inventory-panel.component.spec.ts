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
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  INVENTORY_CATEGORIES,
  InventoryCategoryDescriptor,
  InventoryConnection,
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
  let connections$: BehaviorSubject<InventoryConnection[]>;
  let connection$: BehaviorSubject<InventoryConnection | null>;
  let fixture: Awaited<
    ReturnType<typeof renderComponent<InventoryPanelComponent>>
  >['fixture'];
  let inventoryServiceSpy: {
    loadConnections: ReturnType<
      typeof vi.fn<InventoryService['loadConnections']>
    >;
    selectConnection: ReturnType<
      typeof vi.fn<InventoryService['selectConnection']>
    >;
    loadAll: ReturnType<typeof vi.fn<InventoryService['loadAll']>>;
    refresh: ReturnType<typeof vi.fn<InventoryService['refresh']>>;
    setFilter: ReturnType<typeof vi.fn<InventoryService['setFilter']>>;
    setScope: ReturnType<typeof vi.fn<InventoryService['setScope']>>;
  };

  beforeEach(async () => {
    filter$ = new BehaviorSubject<string>('');
    refreshing$ = new BehaviorSubject<boolean>(false);
    connections$ = new BehaviorSubject<InventoryConnection[]>([]);
    connection$ = new BehaviorSubject<InventoryConnection | null>(null);

    // No live API in specs: the query and service are both stubbed.
    inventoryServiceSpy = {
      loadConnections: vi.fn<InventoryService['loadConnections']>(() => of([])),
      selectConnection: vi.fn<InventoryService['selectConnection']>(() =>
        of([]),
      ),
      loadAll: vi.fn<InventoryService['loadAll']>(() => of([])),
      refresh: vi.fn<InventoryService['refresh']>(() => of([])),
      setFilter: vi.fn<InventoryService['setFilter']>(),
      setScope: vi.fn<InventoryService['setScope']>(),
    } satisfies Partial<InventoryService>;

    ({ fixture } = await renderComponent(InventoryPanelComponent, {
      inputs: { projectId: 'p1' },
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
        MatSelectModule,
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
            connections$,
            connection$,
          },
        },
        { provide: InventoryService, useValue: inventoryServiceSpy },
      ],
    }));
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
    expect(inventoryServiceSpy.loadConnections).not.toHaveBeenCalled();
    expect(inventoryServiceSpy.loadAll).not.toHaveBeenCalled();

    component.onExpanded();
    component.onCollapsed();
    component.onExpanded();

    expect(inventoryServiceSpy.loadConnections).toHaveBeenCalledTimes(1);
    expect(inventoryServiceSpy.loadAll).toHaveBeenCalledTimes(1);
  });

  const proxmox: InventoryConnection = {
    name: 'dev-proxmox',
    provider: 'proxmox',
    enabled: true,
    isDefault: true,
    lastUpdated: null,
  };
  const vmc: InventoryConnection = {
    name: 'phl-vmc',
    provider: 'vsphere',
    enabled: true,
    isDefault: false,
    lastUpdated: null,
  };

  /**
   * Verifies: with one connection the panel still says which it lists, below the header, with nothing to choose.
   * Interacts with: InventoryQuery.connections$ and connection$ (subjects); the connection mat-select.
   * Data: dev-proxmox only.
   */
  it('shows the only connection without offering a choice', async () => {
    connections$.next([proxmox]);
    connection$.next(proxmox);
    fixture.detectChanges();
    // mat-select shows the chosen option's text once its options have rendered.
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const select = el.querySelector('mat-select');
    expect(select?.textContent.trim()).toBe('dev-proxmox (Proxmox)');
    expect(select?.getAttribute('aria-disabled')).toBe('true');
    expect(
      el.querySelector('mat-expansion-panel-header')?.textContent,
    ).not.toContain('dev-proxmox');
  });

  /**
   * Verifies: with several connections a dropdown lists each by name and provider, the header stays short, a disabled one cannot be chosen, and choosing one switches the lists to it.
   * Interacts with: the connection mat-select; InventoryService.selectConnection (stub).
   * Data: dev-proxmox (default), phl-vmc, and a disabled lab connection.
   */
  it('lets the user switch between several connections', async () => {
    const disabled: InventoryConnection = {
      ...vmc,
      name: 'lab',
      enabled: false,
    };
    connections$.next([proxmox, vmc, disabled]);
    connection$.next(proxmox);
    fixture.detectChanges();

    const trigger: HTMLElement = fixture.nativeElement.querySelector(
      '[aria-label="Infrastructure connection"] .mat-mdc-select-trigger',
    );
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const options = Array.from<HTMLElement>(
      document.querySelectorAll('mat-option'),
    );
    expect(options.map((o) => o.textContent.trim())).toEqual([
      'dev-proxmox (Proxmox)',
      'phl-vmc (vSphere)',
      'lab (vSphere) - disabled',
    ]);
    expect(options[2].getAttribute('aria-disabled')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('mat-expansion-panel-header')
        ?.textContent,
    ).not.toContain('dev-proxmox');

    options[1].click();
    fixture.detectChanges();

    expect(inventoryServiceSpy.selectConnection).toHaveBeenCalledWith(
      'phl-vmc',
    );
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
