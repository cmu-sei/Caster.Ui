// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { InventoryQuery, InventoryService } from '../../state';
import { InventoryPanelComponent } from './inventory-panel.component';

describe('InventoryPanelComponent', () => {
  let component: InventoryPanelComponent;
  let fixture: ComponentFixture<InventoryPanelComponent>;

  let filter$: BehaviorSubject<string>;
  let refreshing$: BehaviorSubject<boolean>;
  let inventoryServiceSpy: jasmine.SpyObj<InventoryService>;

  beforeEach(waitForAsync(() => {
    filter$ = new BehaviorSubject<string>('');
    refreshing$ = new BehaviorSubject<boolean>(false);

    // No live API in specs: the query and service are both stubbed.
    inventoryServiceSpy = jasmine.createSpyObj<InventoryService>(
      'InventoryService',
      ['loadAll', 'refresh', 'setFilter']
    );
    inventoryServiceSpy.loadAll.and.returnValue(of([]));
    inventoryServiceSpy.refresh.and.returnValue(of([]));

    TestBed.configureTestingModule({
      declarations: [InventoryPanelComponent],
      providers: [
        { provide: InventoryQuery, useValue: { filter$, refreshing$ } },
        { provide: InventoryService, useValue: inventoryServiceSpy },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(InventoryPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists all four inventory categories', () => {
    expect(component.categories.map((c) => c.category)).toEqual([
      'vmTemplates',
      'isos',
      'networks',
      'datastores',
    ]);
  });

  it('loads once, only after the panel is opened', () => {
    expect(inventoryServiceSpy.loadAll).not.toHaveBeenCalled();

    component.onExpanded();
    component.onCollapsed();
    component.onExpanded();

    expect(inventoryServiceSpy.loadAll).toHaveBeenCalledTimes(1);
  });

  it('pushes and clears the search term', () => {
    component.applyFilter('ubuntu');
    expect(inventoryServiceSpy.setFilter).toHaveBeenCalledWith('ubuntu');

    component.clearFilter();
    expect(component.filterString).toBe('');
    expect(inventoryServiceSpy.setFilter).toHaveBeenCalledWith('');
  });

  it('triggers a manual refresh', () => {
    component.refresh();
    expect(inventoryServiceSpy.refresh).toHaveBeenCalledTimes(1);
  });
});
