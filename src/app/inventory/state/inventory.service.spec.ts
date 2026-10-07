// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InventoryApiService } from '../api/inventory-api.service';
import { InventoryCategory, InventoryResponse } from './inventory.model';
import { InventoryService } from './inventory.service';
import { createInitialInventoryState, InventoryStore } from './inventory.store';

function response(
  overrides: Partial<InventoryResponse> = {}
): InventoryResponse {
  return {
    items: [],
    lastUpdated: null,
    available: true,
    error: null,
    ...overrides,
  };
}

describe('InventoryService', () => {
  let service: InventoryService;
  let store: InventoryStore;
  let apiSpy: jasmine.SpyObj<InventoryApiService>;

  beforeEach(() => {
    // There is no live API, so the hand-written client is stubbed wholesale.
    apiSpy = jasmine.createSpyObj<InventoryApiService>('InventoryApiService', [
      'getCategory',
      'refresh',
    ]);
    apiSpy.refresh.and.returnValue(of(null));

    TestBed.configureTestingModule({
      providers: [{ provide: InventoryApiService, useValue: apiSpy }],
    });

    store = TestBed.inject(InventoryStore);
    store.update(createInitialInventoryState());
    service = TestBed.inject(InventoryService);
  });

  it('stores items on a successful load', () => {
    apiSpy.getCategory.and.returnValue(
      of(
        response({
          items: [
            {
              id: 'vm-1',
              name: 'ubuntu-2204-template',
              path: '/dc/vm/ubuntu-2204-template',
              properties: {},
            },
          ],
          lastUpdated: '2026-10-07T12:00:00Z',
        })
      )
    );

    service.load(InventoryCategory.VmTemplates).subscribe();

    const state = store.getValue()[InventoryCategory.VmTemplates];
    expect(state.available).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.items.length).toBe(1);
  });

  it('treats available: false as a normal outcome and clears loading', () => {
    apiSpy.getCategory.and.returnValue(
      of(response({ available: false, error: 'Inventory is not configured' }))
    );

    service.load(InventoryCategory.Networks).subscribe();

    const state = store.getValue()[InventoryCategory.Networks];
    expect(state.available).toBe(false);
    expect(state.error).toBe('Inventory is not configured');
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.loadFailed).toBe(false);
  });

  it('keeps each category independent when only ISOs are unavailable', () => {
    apiSpy.getCategory.and.callFake((category: InventoryCategory) =>
      category === InventoryCategory.Isos
        ? of(response({ available: false, error: 'Known API limitation.' }))
        : of(
            response({
              items: [
                {
                  id: `${category}-1`,
                  name: category,
                  path: '/',
                  properties: {},
                },
              ],
            })
          )
    );

    service.loadAll().subscribe();

    const value = store.getValue();
    expect(value[InventoryCategory.Isos].available).toBe(false);
    expect(value[InventoryCategory.VmTemplates].available).toBe(true);
    expect(value[InventoryCategory.Networks].items.length).toBe(1);
    expect(value[InventoryCategory.Datastores].items.length).toBe(1);
  });

  it('clears loading on a transport failure without erroring the stream', () => {
    apiSpy.getCategory.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404 }))
    );

    let errored = false;
    service.load(InventoryCategory.Datastores).subscribe({
      error: () => (errored = true),
    });

    expect(errored).toBe(false);

    const state = store.getValue()[InventoryCategory.Datastores];
    expect(state.loading).toBe(false);
    expect(state.loaded).toBe(true);
    expect(state.loadFailed).toBe(true);
  });

  it('clears refreshing even when the refresh call fails', () => {
    apiSpy.refresh.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 }))
    );
    apiSpy.getCategory.and.returnValue(of(response({ available: false })));

    service.refresh().subscribe();

    expect(store.getValue().refreshing).toBe(false);
    expect(apiSpy.getCategory).toHaveBeenCalledTimes(4);
  });

  it('stores the search term', () => {
    service.setFilter('ubuntu');
    expect(store.getValue().filter).toBe('ubuntu');
  });
});
