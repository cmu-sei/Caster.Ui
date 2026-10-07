// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, Optional } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_PATH } from '../../generated/caster-api';
import { InventoryCategory, InventoryResponse } from '../state/inventory.model';

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
 *   POST /api/inventory/refresh
 */

/** Maps a category onto its URL segment. */
const INVENTORY_ROUTE_SEGMENTS: { [key in InventoryCategory]: string } = {
  [InventoryCategory.VmTemplates]: 'vm-templates',
  [InventoryCategory.Isos]: 'isos',
  [InventoryCategory.Networks]: 'networks',
  [InventoryCategory.Datastores]: 'datastores',
};

@Injectable({
  providedIn: 'root',
})
export class InventoryApiService {
  // Matches the fallback the generated client uses when BASE_PATH is absent.
  private basePath = 'http://localhost';

  constructor(
    private httpClient: HttpClient,
    @Optional() @Inject(BASE_PATH) basePath?: string | string[]
  ) {
    if (Array.isArray(basePath) && basePath.length > 0) {
      this.basePath = basePath[0];
    } else if (typeof basePath === 'string') {
      this.basePath = basePath;
    }
  }

  /** Reads one inventory category. */
  getCategory(category: InventoryCategory): Observable<InventoryResponse> {
    return this.httpClient.get<InventoryResponse>(
      `${this.basePath}/api/inventory/${INVENTORY_ROUTE_SEGMENTS[category]}`
    );
  }

  /** Asks the API to re-read the inventory from vCenter. */
  refresh(): Observable<unknown> {
    return this.httpClient.post<unknown>(
      `${this.basePath}/api/inventory/refresh`,
      null
    );
  }
}
