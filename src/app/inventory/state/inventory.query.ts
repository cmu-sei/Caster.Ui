// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { combineLatest, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import {
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryCategoryState,
  InventoryItem,
  inventoryItemMatches,
} from './inventory.model';
import { InventoryState, InventoryStore } from './inventory.store';

@Injectable({
  providedIn: 'root',
})
export class InventoryQuery extends Query<InventoryState> {
  readonly filter$: Observable<string> = this.select('filter');
  readonly refreshing$: Observable<boolean> = this.select('refreshing');

  /**
   * When the inventory was last read, shown once for every category. They are
   * refreshed together but each answers with its own time, so the oldest is
   * used: it never claims fresher data than any category has. Null until an
   * available category has loaded.
   */
  readonly lastUpdated$: Observable<string | null> = this.select((state) =>
    INVENTORY_CATEGORIES.map((d) => state[d.category])
      .filter((c) => c.loaded && c.available && c.lastUpdated)
      .map((c) => c.lastUpdated)
      .reduce<string | null>(
        (oldest, t) =>
          oldest === null || Date.parse(t) < Date.parse(oldest) ? t : oldest,
        null
      )
  );

  constructor(protected store: InventoryStore) {
    super(store);
  }

  /** The full state slice for one category, including its own availability. */
  selectCategory(
    category: InventoryCategory
  ): Observable<InventoryCategoryState> {
    return this.select((state) => state[category]);
  }

  /** Items for one category with the shared search term applied. */
  selectFilteredItems(
    category: InventoryCategory
  ): Observable<InventoryItem[]> {
    return combineLatest([this.selectCategory(category), this.filter$]).pipe(
      map(([categoryState, filter]) =>
        categoryState.items.filter((item) => inventoryItemMatches(item, filter))
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
}
