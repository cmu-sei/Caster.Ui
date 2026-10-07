// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { InventoryApiService } from '../api/inventory-api.service';
import {
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryCategoryState,
  InventoryResponse,
} from './inventory.model';
import { InventoryState, InventoryStore } from './inventory.store';

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  constructor(
    private inventoryStore: InventoryStore,
    private inventoryApiService: InventoryApiService
  ) {}

  /**
   * Loads a single category. Never errors: a transport failure is folded into
   * that category's slice so the other three still render.
   */
  load(category: InventoryCategory): Observable<InventoryResponse | null> {
    this.patch(category, { loading: true, loadFailed: false });

    return this.inventoryApiService.getCategory(category).pipe(
      tap((response) => {
        this.patch(category, {
          items: response?.items ?? [],
          lastUpdated: response?.lastUpdated ?? null,
          // An explicit `false` is the normal "not configured" case. Absent
          // the flag we assume available so a list still renders.
          available: response?.available !== false,
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
          error: this.describeTransportError(error),
          loading: false,
          loaded: true,
          loadFailed: true,
        });
        return of(null);
      })
    );
  }

  /** Loads all four categories in parallel. */
  loadAll(): Observable<(InventoryResponse | null)[]> {
    return forkJoin(
      INVENTORY_CATEGORIES.map((descriptor) => this.load(descriptor.category))
    );
  }

  /**
   * Manual refresh: ask the API to re-read vCenter, then reload every list.
   * A failing refresh call still reloads, so each list reports its own state.
   */
  refresh(): Observable<(InventoryResponse | null)[]> {
    this.inventoryStore.update({ refreshing: true });

    return this.inventoryApiService.refresh().pipe(
      catchError(() => of(null)),
      switchMap(() => this.loadAll()),
      finalize(() => this.inventoryStore.update({ refreshing: false }))
    );
  }

  setFilter(filter: string) {
    this.inventoryStore.update({ filter: filter ?? '' });
  }

  private patch(
    category: InventoryCategory,
    changes: Partial<InventoryCategoryState>
  ) {
    this.inventoryStore.update(
      (state) =>
        ({
          [category]: { ...state[category], ...changes },
        } as Partial<InventoryState>)
    );
  }

  private describeTransportError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'Inventory is not available on this Caster API.';
    }
    return 'Inventory could not be read right now.';
  }
}
