// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import {
  InventoryConnection,
  InventoryResult,
  InventoryService as InventoryApiService,
} from '../../generated/caster-api';
import {
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryCategoryState,
} from './inventory.model';
import {
  initialInventoryCategoryState,
  InventoryState,
  InventoryStore,
} from './inventory.store';

/** Where the panel remembers the chosen connection, per browser. */
export const INVENTORY_CONNECTION_KEY = 'caster.inventory.connection';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private inventoryStore = inject(InventoryStore);
  private inventoryApiService = inject(InventoryApiService);

  /**
   * Loads a single category. Never errors: a transport failure is folded into
   * that category's slice so the others still render.
   */
  load(category: InventoryCategory): Observable<InventoryResult | null> {
    this.patch(category, { loading: true, loadFailed: false });
    const connection = this.inventoryStore.getValue().connection ?? undefined;

    return this.read(category, connection).pipe(
      tap((response) => {
        this.patch(category, {
          items: response?.items ?? [],
          lastUpdated: response?.lastUpdated ?? null,
          // An explicit `false` is the normal "not configured" case. Absent
          // the flag we assume available so a list still renders.
          available: response?.available !== false,
          applies: response?.applies !== false,
          enabled: response?.enabled !== false,
          stale: response?.stale === true,
          error: response?.error ?? null,
          loading: false,
          loaded: true,
          loadFailed: false,
        });
      }),
      catchError((error: unknown) => {
        this.patch(category, {
          items: [],
          lastUpdated: null,
          available: false,
          // Unknown, so it stays listed with the error.
          applies: true,
          enabled: true,
          stale: false,
          error: this.describeTransportError(error),
          loading: false,
          loaded: true,
          loadFailed: true,
        });
        return of(null);
      }),
    );
  }

  /** Loads every category in parallel. */
  loadAll(): Observable<(InventoryResult | null)[]> {
    return forkJoin(
      INVENTORY_CATEGORIES.map((descriptor) => this.load(descriptor.category)),
    );
  }

  /**
   * Manual refresh: ask the API to re-read vCenter, then reload every list.
   * A failing refresh call still reloads, so each list reports its own state.
   */
  refresh(): Observable<(InventoryResult | null)[]> {
    this.inventoryStore.update({ refreshing: true });
    const connection = this.inventoryStore.getValue().connection ?? undefined;

    return this.inventoryApiService.refreshInventory(connection).pipe(
      catchError(() => of(null)),
      switchMap(() => this.loadAll()),
      finalize(() => this.inventoryStore.update({ refreshing: false })),
    );
  }

  /**
   * Lists the connections and picks the one to read: the one this browser
   * chose last if it is still enabled, otherwise the default. Never errors: if
   * the list can't be read, no connection is named and the lists read the
   * API's default.
   */
  loadConnections(): Observable<InventoryConnection[]> {
    return this.inventoryApiService.getInventoryConnections().pipe(
      catchError(() => of([] as InventoryConnection[])),
      map((connections) => connections ?? []),
      tap((connections) => {
        const enabled = connections.filter((c) => c.enabled);
        const remembered = readRememberedConnection();
        const chosen =
          enabled.find((c) => c.name === remembered) ??
          enabled.find((c) => c.isDefault) ??
          enabled[0] ??
          null;
        this.inventoryStore.update({
          connections,
          connection: chosen?.name ?? null,
        });
      }),
    );
  }

  /**
   * Switches the lists to another connection, remembers it for this browser,
   * and reloads every category from it.
   */
  selectConnection(name: string): Observable<(InventoryResult | null)[]> {
    rememberConnection(name);
    this.inventoryStore.update({
      connection: name,
      ...Object.fromEntries(
        INVENTORY_CATEGORIES.map((d) => [
          d.category,
          { ...initialInventoryCategoryState },
        ]),
      ),
    } as Partial<InventoryState>);
    return this.loadAll();
  }

  /** Reads one category of a connection, the API's default when none is named. */
  private read(
    category: InventoryCategory,
    connection?: string,
  ): Observable<InventoryResult> {
    switch (category) {
      case InventoryCategory.VmTemplates:
        return this.inventoryApiService.getInventoryVmTemplates(connection);
      case InventoryCategory.Isos:
        return this.inventoryApiService.getInventoryIsos(connection);
      case InventoryCategory.Networks:
        return this.inventoryApiService.getInventoryNetworks(connection);
      case InventoryCategory.Datastores:
        return this.inventoryApiService.getInventoryDatastores(connection);
      case InventoryCategory.ContentLibrary:
        return this.inventoryApiService.getInventoryContentLibrary(connection);
    }
  }

  setFilter(filter: string) {
    this.inventoryStore.update({ filter: filter ?? '' });
  }

  private patch(
    category: InventoryCategory,
    changes: Partial<InventoryCategoryState>,
  ) {
    this.inventoryStore.update(
      (state) =>
        ({
          [category]: { ...state[category], ...changes },
        }) as Partial<InventoryState>,
    );
  }

  private describeTransportError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'Inventory is not available on this Caster API.';
    }
    return 'Inventory could not be read right now.';
  }
}

function readRememberedConnection(): string | null {
  try {
    return localStorage.getItem(INVENTORY_CONNECTION_KEY);
  } catch {
    return null;
  }
}

function rememberConnection(name: string) {
  try {
    localStorage.setItem(INVENTORY_CONNECTION_KEY, name);
  } catch {
    // Storage can be off; the choice then lasts until the page reloads.
  }
}
