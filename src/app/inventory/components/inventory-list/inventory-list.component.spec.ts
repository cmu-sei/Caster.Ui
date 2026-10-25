// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryCategoryState,
  InventoryItem,
  InventoryQuery,
  InventoryService,
} from '../../state';
import { InventoryListComponent } from './inventory-list.component';

function categoryState(
  overrides: Partial<InventoryCategoryState> = {},
): InventoryCategoryState {
  return {
    items: [],
    lastUpdated: null,
    available: true,
    stale: false,
    error: null,
    loading: false,
    loaded: true,
    loadFailed: false,
    ...overrides,
  };
}

describe('InventoryListComponent', () => {
  let component: InventoryListComponent;
  let fixture: ComponentFixture<InventoryListComponent>;

  let state$: BehaviorSubject<InventoryCategoryState>;
  let items$: BehaviorSubject<InventoryItem[]>;
  let filter$: BehaviorSubject<string>;
  let inventoryServiceSpy: {
    load: ReturnType<typeof vi.fn<InventoryService['load']>>;
  };

  const isosDescriptor = INVENTORY_CATEGORIES.find(
    (d) => d.category === InventoryCategory.Isos,
  );

  beforeEach(async () => {
    state$ = new BehaviorSubject<InventoryCategoryState>(categoryState());
    items$ = new BehaviorSubject<InventoryItem[]>([]);
    filter$ = new BehaviorSubject<string>('');

    // No live API in specs: the query is stubbed with plain subjects.
    inventoryServiceSpy = {
      load: vi.fn<InventoryService['load']>(() => of(null)),
    } satisfies Partial<InventoryService>;

    const view = await renderComponent(InventoryListComponent, {
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
      inputs: { descriptor: isosDescriptor },
      providers: [
        {
          provide: InventoryQuery,
          useValue: {
            filter$,
            selectCategory: () => state$,
            selectFilteredItems: () => items$,
          },
        },
        { provide: InventoryService, useValue: inventoryServiceSpy },
        {
          provide: MatSnackBar,
          useValue: { open: vi.fn() },
        },
      ],
    });
    fixture = view.fixture;
    component = fixture.componentInstance;
  });

  /**
   * Verifies: the list renders for the ISOs category.
   * Interacts with: InventoryQuery (selectCategory, selectFilteredItems subjects); InventoryService (stub).
   * Data: ISOs, loaded with no items.
   */
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Verifies: an unavailable category shows the API's message and offers no retry.
   * Interacts with: the .state-row.unavailable row and .retry-link.
   * Data: ISOs, available false, 'Inventory is not configured'.
   */
  it('renders the API message when available is false', () => {
    state$.next(
      categoryState({ available: false, error: 'Inventory is not configured' }),
    );
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.state-row.unavailable');
    expect(row.textContent).toContain('Inventory is not configured');
    // available: false is informational, so no retry affordance is offered.
    expect(fixture.nativeElement.querySelector('.retry-link')).toBeNull();
  });

  /**
   * Verifies: an unavailable category with no message shows the category's fallback message.
   * Interacts with: InventoryCategoryDescriptor.fallbackUnavailableMessage.
   * Data: ISOs, available false, error null.
   */
  it('falls back to a category message when error is null', () => {
    state$.next(categoryState({ available: false, error: null }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      isosDescriptor.fallbackUnavailableMessage,
    );
  });

  /**
   * Verifies: a failed HTTP call offers a retry, and retrying reloads that category.
   * Interacts with: the .retry-link; InventoryService.load (stub).
   * Data: ISOs, loadFailed true.
   */
  it('offers a retry only when the HTTP call itself failed', () => {
    state$.next(categoryState({ available: false, loadFailed: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.retry-link')).toBeTruthy();

    component.retry();
    expect(inventoryServiceSpy.load).toHaveBeenCalledWith(
      InventoryCategory.Isos,
    );
  });

  /**
   * Verifies: an item whose name is an id shows its alias, or failing that its
   *   comment, under the name; an item with neither shows only its name.
   * Interacts with: the .item-label line.
   * Data: vnet01 with alias Red Team LAN; vmbr1 with comment Blue Team LAN;
   *   vmbr0 with no label.
   */
  it('shows a readable name under an id-only name', () => {
    const items: InventoryItem[] = [
      {
        id: 'vnet01',
        name: 'vnet01',
        path: 'vnet01',
        properties: { alias: 'Red Team LAN', comment: 'ignored' },
      },
      {
        id: 'vmbr1',
        name: 'vmbr1',
        path: 'vmbr1',
        properties: { comment: 'Blue Team LAN' },
      },
      { id: 'vmbr0', name: 'vmbr0', path: 'vmbr0', properties: {} },
    ];
    state$.next(categoryState({ items }));
    items$.next(items);
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.item-label'),
    ).map((el: HTMLElement) => el.textContent.trim());
    expect(labels).toEqual(['Red Team LAN', 'Blue Team LAN']);
  });

  /**
   * Verifies: a readable category with no items says 'Nothing found' instead of unavailable.
   * Interacts with: the list's empty state.
   * Data: ISOs, available, no items.
   */
  it('distinguishes an empty result from an unavailable category', () => {
    state$.next(categoryState({ items: [] }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nothing found');
  });

  /**
   * Verifies: a kept earlier read still lists its items, and says it is stale, from when and why.
   * Interacts with: the .state-row.stale row and the header's .stale-icon.
   * Data: ISOs, stale, one ISO, a refused connection.
   */
  it('lists a stale category and says why it could not refresh', () => {
    const iso = {
      id: 'local:iso/kali.iso',
      name: 'local:iso/kali.iso',
      path: 'local:iso/kali.iso',
      properties: {},
    };
    state$.next(
      categoryState({
        items: [iso],
        stale: true,
        lastUpdated: '2026-10-24T09:30:00Z',
        error: 'Could not connect to Proxmox: Connection refused',
      }),
    );
    items$.next([iso]);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.state-row.stale');
    expect(row.textContent).toContain(
      'Could not refresh. Showing the list from',
    );
    expect(row.textContent).toContain('Connection refused');
    expect(fixture.nativeElement.querySelector('.stale-icon')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.item-name').textContent,
    ).toContain('local:iso/kali.iso');
    expect(
      fixture.nativeElement.querySelector('.state-row.unavailable'),
    ).toBeNull();
  });

  /**
   * Verifies: a fresh category shows no stale note.
   * Interacts with: the .state-row.stale row.
   * Data: ISOs, available, not stale.
   */
  it('shows no stale note for a fresh read', () => {
    state$.next(categoryState({ items: [] }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.state-row.stale')).toBeNull();
    expect(fixture.nativeElement.querySelector('.stale-icon')).toBeNull();
  });

  /**
   * Verifies: the tooltip lists the path, then the properties sorted by key.
   * Interacts with: InventoryListComponent.propertiesTooltip.
   * Data: a VM template with guestOs and cpuCount.
   */
  it('builds a properties tooltip from path and properties', () => {
    const tooltip = component.propertiesTooltip({
      id: 'vm-1',
      name: 'win2019-template',
      path: '/dc/vm/win2019-template',
      properties: { guestOs: 'windows2019srv_64Guest', cpuCount: '4' },
    });

    expect(tooltip).toBe(
      '/dc/vm/win2019-template · cpuCount: 4 · guestOs: windows2019srv_64Guest',
    );
  });

  /**
   * Verifies: the copy confirmation names what was copied.
   * Interacts with: MatSnackBar.open (stub).
   * Data: vmbr1.
   */
  it('says which name it copied', () => {
    component.onClipboardSuccess('vmbr1');

    expect(TestBed.inject(MatSnackBar).open).toHaveBeenCalledWith(
      'Copied vmbr1 to clipboard',
      'Dismiss',
    );
  });
});
