// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { InventoryCategory, InventoryCategoryState } from './inventory.model';
import { InventoryQuery } from './inventory.query';
import { initialInventoryCategoryState, InventoryStore } from './inventory.store';

describe('InventoryQuery', () => {
  let query: InventoryQuery;
  let store: InventoryStore;

  function setCategory(
    category: InventoryCategory,
    overrides: Partial<InventoryCategoryState>
  ) {
    store.update({
      [category]: {
        ...initialInventoryCategoryState,
        loaded: true,
        available: true,
        ...overrides,
      },
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(InventoryStore);
    query = TestBed.inject(InventoryQuery);
  });

  it('has no last updated time before anything has loaded', async () => {
    expect(await firstValueFrom(query.lastUpdated$)).toBeNull();
  });

  it('uses the oldest time across the categories', async () => {
    setCategory(InventoryCategory.VmTemplates, {
      lastUpdated: '2026-10-16T12:05:00Z',
    });
    setCategory(InventoryCategory.Isos, { lastUpdated: '2026-10-16T12:00:00Z' });
    setCategory(InventoryCategory.Networks, {
      lastUpdated: '2026-10-16T12:10:00Z',
    });

    expect(await firstValueFrom(query.lastUpdated$)).toBe(
      '2026-10-16T12:00:00Z'
    );
  });

  it('ignores a category that is unavailable', async () => {
    setCategory(InventoryCategory.VmTemplates, {
      lastUpdated: '2026-10-16T12:05:00Z',
    });
    setCategory(InventoryCategory.Isos, {
      available: false,
      lastUpdated: '2026-10-16T09:00:00Z',
    });

    expect(await firstValueFrom(query.lastUpdated$)).toBe(
      '2026-10-16T12:05:00Z'
    );
  });
});
