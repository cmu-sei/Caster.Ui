// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_PATH } from '../../generated/caster-api';
import {
  InventoryCategory,
  InventoryConnection,
  InventoryResponse,
} from '../state/inventory.model';

/**
 * TEMPORARY, HAND-WRITTEN API CLIENT -- REPLACE ME.
 *
 * The rest of this app talks to the Caster API through the OpenAPI client in
 * `src/app/generated/caster-api`, regenerated with `npm run swagger:gen`. The
 * `/api/inventory/*` endpoints were added to caster.api in parallel with this
 * UI work, so they are not in the checked-in swagger.json and could not be
 * generated here.
 *
 * WHEN THE API LANDS:
 *   1. Run `npm run swagger:gen` against a running caster.api.
 *   2. Delete this file and the `src/app/inventory/api` folder.
 *   3. Point `InventoryService` at the generated `InventoryService` /
 *      `InventoryItem` / `InventoryResponse` types from
 *      `src/app/generated/caster-api` instead of the hand-written models in
 *      `src/app/inventory/state/inventory.model.ts`.
 *
 * Do not hand-edit anything under `src/app/generated/`.
 *
 * Contract implemented here:
 *   GET  /api/inventory/vm-templates
 *   GET  /api/inventory/isos
 *   GET  /api/inventory/networks
 *   GET  /api/inventory/datastores
 *   GET  /api/inventory/content-library
 *   GET  /api/inventory/hosts
 *   GET  /api/inventory/connections
 *   POST /api/inventory/refresh
 *
 * Every GET and the refresh take an optional `connection`, which names one of
 * the configured connections; without it the API reads the default.
 */

/** Maps a category onto its URL segment. */
const INVENTORY_ROUTE_SEGMENTS: { [key in InventoryCategory]: string } = {
  [InventoryCategory.VmTemplates]: 'vm-templates',
  [InventoryCategory.Isos]: 'isos',
  [InventoryCategory.Networks]: 'networks',
  [InventoryCategory.Datastores]: 'datastores',
  [InventoryCategory.ContentLibrary]: 'content-library',
};

@Injectable({
  providedIn: 'root',
})
export class InventoryApiService {
  // Matches the fallback the generated client uses when BASE_PATH is absent.
  private basePath = 'http://localhost';

  private httpClient = inject(HttpClient);

  constructor() {
    const basePath = inject<string | string[]>(BASE_PATH, { optional: true });

    if (Array.isArray(basePath) && basePath.length > 0) {
      this.basePath = basePath[0];
    } else if (typeof basePath === 'string') {
      this.basePath = basePath;
    }
  }

  /** Reads one inventory category. */
  getCategory(
    category: InventoryCategory,
    connection?: string
  ): Observable<InventoryResponse> {
    return this.httpClient.get<InventoryResponse>(
      `${this.basePath}/api/inventory/${INVENTORY_ROUTE_SEGMENTS[category]}`,
      { params: connectionParams(connection) }
    );
  }

  /**
   * Reads the hypervisor hosts with their cpu and memory use. Not an
   * `InventoryCategory`: hosts are not something a Terraform author picks, so
   * the project panel does not list them.
   */
  getHosts(connection?: string): Observable<InventoryResponse> {
    return this.httpClient.get<InventoryResponse>(
      `${this.basePath}/api/inventory/hosts`,
      { params: connectionParams(connection) }
    );
  }

  /** Lists the configured connections, the default first. */
  getConnections(): Observable<InventoryConnection[]> {
    return this.httpClient.get<InventoryConnection[]>(
      `${this.basePath}/api/inventory/connections`
    );
  }

  /** Asks the API to re-read a connection's inventory from the hypervisor. */
  refresh(connection?: string): Observable<unknown> {
    return this.httpClient.post<unknown>(
      `${this.basePath}/api/inventory/refresh`,
      null,
      { params: connectionParams(connection) }
    );
  }
}

function connectionParams(connection?: string): HttpParams {
  return connection
    ? new HttpParams().set('connection', connection)
    : new HttpParams();
}
