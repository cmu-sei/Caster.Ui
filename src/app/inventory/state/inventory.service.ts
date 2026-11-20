// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import {
  InventoryConnection,
  InventoryRefreshResult,
  InventoryResult,
  InventoryService as InventoryApiService,
  ProjectInventoryService as ProjectInventoryApiService,
} from '../../generated/caster-api';
import {
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryCategoryState,
} from './inventory.model';
import {
  createInitialInventoryState,
  initialInventoryCategoryState,
  InventoryState,
  InventoryStore,
} from './inventory.store';

/**
 * The inventory a panel shows: one project's assigned connections, or, for
 * ViewInfrastructure holders, every connection. State belongs to one scope; a
 * change of project or mode clears it, and a response for another scope is
 * dropped.
 */
@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private inventoryStore = inject(InventoryStore);
  private inventoryApiService = inject(InventoryApiService);
  private projectInventoryApiService = inject(ProjectInventoryApiService);

  /**
   * Points the lists at a project's connections, or every connection with
   * showAll. Clears everything read for another scope.
   */
  setScope(projectId: string | null, showAll = false) {
    const state = this.inventoryStore.getValue();

    if (state.projectId === projectId && state.showAll === showAll) {
      return;
    }

    this.inventoryStore.update({
      ...createInitialInventoryState(),
      filter: state.filter,
      projectId,
      showAll,
    });
  }

  /**
   * Loads a single category. Never errors: a transport failure is folded into
   * that category's slice so the others still render.
   */
  load(category: InventoryCategory): Observable<InventoryResult | null> {
    this.patch(category, { loading: true, loadFailed: false });
    const scope = this.scope();
    const connection = this.inventoryStore.getValue().connection ?? undefined;

    return this.read(category, connection).pipe(
      tap((response) => {
        if (!this.isScope(scope)) {
          return;
        }
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
        if (this.isScope(scope)) {
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
        }
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
   * Manual refresh: ask the API to re-read the connection, then reload every
   * list. A failing refresh call still reloads, so each list reports its own state.
   */
  refresh(): Observable<(InventoryResult | null)[]> {
    this.inventoryStore.update({ refreshing: true });
    const connection = this.inventoryStore.getValue().connection ?? undefined;
    const { projectId, showAll } = this.inventoryStore.getValue();

    const refresh: Observable<InventoryRefreshResult> =
      projectId && !showAll
        ? this.projectInventoryApiService.refreshProjectInventory(
            projectId,
            connection,
          )
        : this.inventoryApiService.refreshInventory(connection);

    return refresh.pipe(
      catchError(() => of(null)),
      switchMap(() => this.loadAll()),
      finalize(() => this.inventoryStore.update({ refreshing: false })),
    );
  }

  /**
   * Lists the connections the scope can read and picks the default: the
   * project's, or the API's with showAll. Never errors: if the list can't be
   * read, no connection is named and the lists read the default.
   */
  loadConnections(): Observable<InventoryConnection[]> {
    const scope = this.scope();
    const { projectId, showAll } = this.inventoryStore.getValue();

    const connections: Observable<InventoryConnection[]> =
      projectId && !showAll
        ? this.projectInventoryApiService.getProjectInventoryConnections(
            projectId,
          )
        : this.inventoryApiService.getInventoryConnections();

    return connections.pipe(
      catchError(() => of([] as InventoryConnection[])),
      map((list) => list ?? []),
      tap((list) => {
        if (!this.isScope(scope)) {
          return;
        }
        const usable = list.filter((c) => c.enabled && c.status !== 'Missing');
        const chosen = usable.find((c) => c.isDefault) ?? usable[0] ?? null;
        this.inventoryStore.update({
          connections: list,
          connection: chosen?.name ?? null,
        });
      }),
    );
  }

  /**
   * After a project's connections are assigned or removed: lists them again and reloads the
   * lists, if the panel is showing that project's and has read them. A panel not yet opened
   * reads them when it is.
   */
  projectConnectionsChanged(projectId: string): Observable<unknown> {
    const state = this.inventoryStore.getValue();
    const read = INVENTORY_CATEGORIES.some((d) => state[d.category].loaded);

    if (state.projectId !== projectId || state.showAll || !read) {
      return of(null);
    }

    return this.loadConnections().pipe(switchMap(() => this.loadAll()));
  }

  /** Switches the lists to another connection and reloads every category from it. */
  selectConnection(name: string): Observable<(InventoryResult | null)[]> {
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

  setFilter(filter: string) {
    this.inventoryStore.update({ filter: filter ?? '' });
  }

  /** Reads one category of a connection, the scope's default when none is named. */
  private read(
    category: InventoryCategory,
    connection?: string,
  ): Observable<InventoryResult> {
    const { projectId, showAll } = this.inventoryStore.getValue();

    if (projectId && !showAll) {
      const api = this.projectInventoryApiService;
      switch (category) {
        case InventoryCategory.VmTemplates:
          return api.getProjectInventoryVmTemplates(projectId, connection);
        case InventoryCategory.Isos:
          return api.getProjectInventoryIsos(projectId, connection);
        case InventoryCategory.Networks:
          return api.getProjectInventoryNetworks(projectId, connection);
        case InventoryCategory.Datastores:
          return api.getProjectInventoryDatastores(projectId, connection);
        case InventoryCategory.ContentLibrary:
          return api.getProjectInventoryContentLibrary(projectId, connection);
      }
    }

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

  private scope(): string {
    const { projectId, showAll } = this.inventoryStore.getValue();
    return `${projectId ?? ''}|${showAll}`;
  }

  private isScope(scope: string): boolean {
    return this.scope() === scope;
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
