// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import {
  InventoryCategory,
  InventoryCategoryState,
  InventoryConnection,
} from './inventory.model';

/** One slice per category, keyed by the `InventoryCategory` string values. */
export type InventoryCategoriesState = {
  [key in InventoryCategory]: InventoryCategoryState;
};

export interface InventoryState extends InventoryCategoriesState {
  /** True while a manual refresh (POST /api/inventory/refresh) is in flight. */
  refreshing: boolean;
  /** Single search term applied across every category. */
  filter: string;
  /** The configured connections, the default first. Empty until listed. */
  connections: InventoryConnection[];
  /**
   * The connection the lists read, by name. Null reads the API's default,
   * which is also what happens when the connections can't be listed.
   */
  connection: string | null;
}

export const initialInventoryCategoryState: InventoryCategoryState = {
  items: [],
  lastUpdated: null,
  // Optimistic until a load resolves; the panel renders the loading state
  // while `loaded` is false, so this value is never shown on its own.
  available: true,
  applies: true,
  stale: false,
  error: null,
  loading: false,
  loaded: false,
  loadFailed: false,
};

export function createInitialInventoryState(): InventoryState {
  return {
    [InventoryCategory.VmTemplates]: { ...initialInventoryCategoryState },
    [InventoryCategory.Isos]: { ...initialInventoryCategoryState },
    [InventoryCategory.Networks]: { ...initialInventoryCategoryState },
    [InventoryCategory.Datastores]: { ...initialInventoryCategoryState },
    [InventoryCategory.ContentLibrary]: { ...initialInventoryCategoryState },
    refreshing: false,
    filter: '',
    connections: [],
    connection: null,
  };
}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'inventory' })
export class InventoryStore extends Store<InventoryState> {
  constructor() {
    super(createInitialInventoryState());
  }
}
