// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
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
  overrides: Partial<InventoryCategoryState> = {}
): InventoryCategoryState {
  return {
    items: [],
    lastUpdated: null,
    available: true,
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
  let inventoryServiceSpy: jasmine.SpyObj<InventoryService>;

  const isosDescriptor = INVENTORY_CATEGORIES.find(
    (d) => d.category === InventoryCategory.Isos
  );

  beforeEach(waitForAsync(() => {
    state$ = new BehaviorSubject<InventoryCategoryState>(categoryState());
    items$ = new BehaviorSubject<InventoryItem[]>([]);
    filter$ = new BehaviorSubject<string>('');

    // No live API in specs: the query is stubbed with plain subjects.
    inventoryServiceSpy = jasmine.createSpyObj<InventoryService>(
      'InventoryService',
      ['load']
    );
    inventoryServiceSpy.load.and.returnValue(of(null));

    TestBed.configureTestingModule({
      declarations: [InventoryListComponent],
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
          useValue: jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']),
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InventoryListComponent);
    component = fixture.componentInstance;
    component.descriptor = isosDescriptor;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the API message when available is false', () => {
    state$.next(
      categoryState({ available: false, error: 'Inventory is not configured' })
    );
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.state-row.unavailable');
    expect(row.textContent).toContain('Inventory is not configured');
    // available: false is informational, so no retry affordance is offered.
    expect(fixture.nativeElement.querySelector('.retry-link')).toBeNull();
  });

  it('falls back to a category message when error is null', () => {
    state$.next(categoryState({ available: false, error: null }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      isosDescriptor.fallbackUnavailableMessage
    );
  });

  it('offers a retry only when the HTTP call itself failed', () => {
    state$.next(categoryState({ available: false, loadFailed: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.retry-link')).toBeTruthy();

    component.retry();
    expect(inventoryServiceSpy.load).toHaveBeenCalledWith(
      InventoryCategory.Isos
    );
  });

  it('distinguishes an empty result from an unavailable category', () => {
    state$.next(categoryState({ items: [] }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nothing found');
  });

  it('builds a properties tooltip from path and properties', () => {
    const tooltip = component.propertiesTooltip({
      id: 'vm-1',
      name: 'win2019-template',
      path: '/dc/vm/win2019-template',
      properties: { guestOs: 'windows2019srv_64Guest', cpuCount: '4' },
    });

    expect(tooltip).toBe(
      '/dc/vm/win2019-template · cpuCount: 4 · guestOs: windows2019srv_64Guest'
    );
  });
});
