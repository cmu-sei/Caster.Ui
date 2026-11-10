// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  ProjectInventoryService as ProjectInventoryApiService,
  InventoryService as InventoryApiService,
  InventoryRefreshResult,
} from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import {
  INVENTORY_CATEGORIES,
  InventoryCategory,
  InventoryConnection,
  InventoryResult,
} from './inventory.model';
import { InventoryService } from './inventory.service';
import { createInitialInventoryState, InventoryStore } from './inventory.store';

function response(overrides: Partial<InventoryResult> = {}): InventoryResult {
  return {
    items: [],
    lastUpdated: null,
    available: true,
    applies: true,
    enabled: true,
    stale: false,
    error: null,
    ...overrides,
  };
}

describe('InventoryService', () => {
  let service: InventoryService;
  let store: InventoryStore;
  let projectApi: {
    getProjectInventoryVmTemplates: ReturnType<typeof vi.fn>;
    getProjectInventoryIsos: ReturnType<typeof vi.fn>;
    getProjectInventoryNetworks: ReturnType<typeof vi.fn>;
    getProjectInventoryDatastores: ReturnType<typeof vi.fn>;
    getProjectInventoryContentLibrary: ReturnType<typeof vi.fn>;
    getProjectInventoryConnections: ReturnType<typeof vi.fn>;
    refreshProjectInventory: ReturnType<typeof vi.fn>;
  };
  // The generated client has a method per category; every one of them goes
  // through getCategory, so a test can stub and assert per category.
  let apiSpy: {
    getCategory: ReturnType<
      typeof vi.fn<
        (
          category: InventoryCategory,
          connection?: string,
        ) => Observable<InventoryResult>
      >
    >;
    refresh: ReturnType<
      typeof vi.fn<(connection?: string) => Observable<InventoryRefreshResult>>
    >;
    getConnections: ReturnType<
      typeof vi.fn<() => Observable<InventoryConnection[]>>
    >;
  };

  beforeEach(() => {
    apiSpy = {
      getCategory: vi.fn(),
      refresh: vi.fn(() => of(null)),
      getConnections: vi.fn(() => of([])),
    };
    const api = {
      getInventoryVmTemplates: (connection?: string) =>
        apiSpy.getCategory(InventoryCategory.VmTemplates, connection),
      getInventoryIsos: (connection?: string) =>
        apiSpy.getCategory(InventoryCategory.Isos, connection),
      getInventoryNetworks: (connection?: string) =>
        apiSpy.getCategory(InventoryCategory.Networks, connection),
      getInventoryDatastores: (connection?: string) =>
        apiSpy.getCategory(InventoryCategory.Datastores, connection),
      getInventoryContentLibrary: (connection?: string) =>
        apiSpy.getCategory(InventoryCategory.ContentLibrary, connection),
      refreshInventory: (connection?: string) => apiSpy.refresh(connection),
      getInventoryConnections: () => apiSpy.getConnections(),
    } satisfies Partial<ApiStub<InventoryApiService>>;
    projectApi = {
      getProjectInventoryVmTemplates: vi.fn(() => of(response())),
      getProjectInventoryIsos: vi.fn(() => of(response())),
      getProjectInventoryNetworks: vi.fn(() => of(response())),
      getProjectInventoryDatastores: vi.fn(() => of(response())),
      getProjectInventoryContentLibrary: vi.fn(() => of(response())),
      getProjectInventoryConnections: vi.fn(() => of([])),
      refreshProjectInventory: vi.fn(() => of(null)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: InventoryApiService, useValue: api },
        { provide: ProjectInventoryApiService, useValue: projectApi },
      ],
    });

    store = TestBed.inject(InventoryStore);
    store.update(createInitialInventoryState());
    service = TestBed.inject(InventoryService);
  });

  /**
   * Verifies: load stores the returned items and clears loading for that category.
   * Interacts with: InventoryApiService.getCategory (stub); real InventoryStore.
   * Data: one VM template, lastUpdated 2026-10-07T12:00:00Z.
   */
  it('stores items on a successful load', () => {
    apiSpy.getCategory.mockReturnValue(
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
        }),
      ),
    );

    service.load(InventoryCategory.VmTemplates).subscribe();

    const state = store.getValue()[InventoryCategory.VmTemplates];
    expect(state.available).toBe(true);
    expect(state.stale).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.items.length).toBe(1);
  });

  /**
   * Verifies: a stale response keeps its items and is stored as stale with its error.
   * Interacts with: InventoryApiService.getCategory (stub); InventoryStore.
   * Data: networks, stale, one network, a refused connection.
   */
  it('stores a stale response with its items and error', () => {
    apiSpy.getCategory.mockReturnValue(
      of(
        response({
          items: [
            { id: 'vmbr1', name: 'vmbr1', path: 'vmbr1', properties: {} },
          ],
          stale: true,
          lastUpdated: '2026-10-24T09:30:00Z',
          error: 'Connection refused',
        }),
      ),
    );

    service.load(InventoryCategory.Networks).subscribe();

    const state = store.getValue()[InventoryCategory.Networks];
    expect(state.available).toBe(true);
    expect(state.stale).toBe(true);
    expect(state.error).toBe('Connection refused');
    expect(state.items.length).toBe(1);
  });

  /**
   * Verifies: an available: false response is stored as a loaded, non-failed category with its message.
   * Interacts with: InventoryApiService.getCategory (stub); real InventoryStore.
   * Data: networks, available false, 'Inventory is not configured'.
   */
  it('treats available: false as a normal outcome and clears loading', () => {
    apiSpy.getCategory.mockReturnValue(
      of(response({ available: false, error: 'Inventory is not configured' })),
    );

    service.load(InventoryCategory.Networks).subscribe();

    const state = store.getValue()[InventoryCategory.Networks];
    expect(state.available).toBe(false);
    expect(state.error).toBe('Inventory is not configured');
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.loadFailed).toBe(false);
  });

  /**
   * Verifies: loadAll stores each category separately, so one unavailable category does not hide the others.
   * Interacts with: InventoryApiService.getCategory (stub per category); real InventoryStore.
   * Data: ISOs unavailable; every other category returns one item.
   */
  it('keeps each category independent when only ISOs are unavailable', () => {
    apiSpy.getCategory.mockImplementation((category: InventoryCategory) =>
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
            }),
          ),
    );

    service.loadAll().subscribe();

    const value = store.getValue();
    expect(value[InventoryCategory.Isos].available).toBe(false);
    expect(value[InventoryCategory.VmTemplates].available).toBe(true);
    expect(value[InventoryCategory.Networks].items.length).toBe(1);
    expect(value[InventoryCategory.Datastores].items.length).toBe(1);
  });

  /**
   * Verifies: an HTTP error marks the category loadFailed and clears loading without erroring the stream.
   * Interacts with: InventoryApiService.getCategory (throws); real InventoryStore.
   * Data: datastores, HTTP 404.
   */
  it('clears loading on a transport failure without erroring the stream', () => {
    apiSpy.getCategory.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
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
    // a failed call says nothing about the provider, so the category stays listed
    expect(state.applies).toBe(true);
  });

  /**
   * Verifies: a category the provider has none of is stored as not applying.
   * Interacts with: InventoryApiService.getCategory (stub); real InventoryStore.
   * Data: content library on Proxmox, applies false.
   */
  it('stores a category that does not apply to the provider', () => {
    apiSpy.getCategory.mockReturnValue(
      of(
        response({
          available: false,
          applies: false,
          error: 'Proxmox has no content libraries.',
        }),
      ),
    );

    service.load(InventoryCategory.ContentLibrary).subscribe();

    const state = store.getValue()[InventoryCategory.ContentLibrary];
    expect(state.applies).toBe(false);
    expect(state.available).toBe(false);
  });

  /**
   * Verifies: an API that does not send the flag yet leaves the category listed.
   * Interacts with: InventoryApiService.getCategory (stub); real InventoryStore.
   * Data: a response without applies.
   */
  it('treats a missing applies flag as applying', () => {
    const { applies: _, ...older } = response();
    apiSpy.getCategory.mockReturnValue(of(older as InventoryResult));

    service.load(InventoryCategory.Networks).subscribe();

    expect(store.getValue()[InventoryCategory.Networks].applies).toBe(true);
  });

  /**
   * Verifies: a failed refresh still clears refreshing and reloads every category.
   * Interacts with: InventoryApiService.refresh (throws), getCategory (stub); real InventoryStore.
   * Data: refresh HTTP 500; every category unavailable.
   */
  it('clears refreshing even when the refresh call fails', () => {
    apiSpy.refresh.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    apiSpy.getCategory.mockReturnValue(of(response({ available: false })));

    service.refresh().subscribe();

    expect(store.getValue().refreshing).toBe(false);
    expect(apiSpy.getCategory).toHaveBeenCalledTimes(
      INVENTORY_CATEGORIES.length,
    );
  });

  /**
   * Verifies: setFilter stores the search term.
   * Interacts with: real InventoryStore.
   * Data: 'ubuntu'.
   */
  it('stores the search term', () => {
    service.setFilter('ubuntu');
    expect(store.getValue().filter).toBe('ubuntu');
  });

  function connection(
    name: string,
    overrides: Partial<InventoryConnection> = {},
  ): InventoryConnection {
    return {
      name,
      provider: 'proxmox',
      enabled: true,
      isDefault: false,
      lastUpdated: null,
      ...overrides,
    };
  }

  /**
   * Verifies: the default connection is read.
   * Interacts with: InventoryApiService.getConnections (stub); real InventoryStore.
   * Data: phl-vmc and dev-proxmox (default).
   */
  it('reads the default connection when nothing was chosen', () => {
    apiSpy.getConnections.mockReturnValue(
      of([
        connection('dev-proxmox', { isDefault: true }),
        connection('phl-vmc', { provider: 'vsphere' }),
      ]),
    );

    service.loadConnections().subscribe();

    expect(store.getValue().connections.map((c) => c.name)).toEqual([
      'dev-proxmox',
      'phl-vmc',
    ]);
    expect(store.getValue().connection).toBe('dev-proxmox');
  });

  /**
   * Verifies: a project scope reads the project's routes, and the system routes with showAll.
   * Interacts with: ProjectInventoryService (stub); InventoryApiService.getCategory (stub).
   * Data: project p1, Networks, then showAll.
   */
  it("reads a project's routes, or every connection with showAll", () => {
    apiSpy.getCategory.mockReturnValue(of(response()));
    service.setScope('p1');

    service.load(InventoryCategory.Networks).subscribe();
    service.loadConnections().subscribe();
    service.refresh().subscribe();

    expect(projectApi.getProjectInventoryNetworks).toHaveBeenCalledWith(
      'p1',
      undefined,
    );
    expect(projectApi.getProjectInventoryConnections).toHaveBeenCalledWith(
      'p1',
    );
    expect(projectApi.refreshProjectInventory).toHaveBeenCalledWith(
      'p1',
      undefined,
    );
    expect(apiSpy.getCategory).not.toHaveBeenCalled();

    service.setScope('p1', true);
    service.load(InventoryCategory.Networks).subscribe();

    expect(apiSpy.getCategory).toHaveBeenCalledWith(
      InventoryCategory.Networks,
      undefined,
    );
  });

  /**
   * Verifies: changing project clears what was read, and an answer for the old project is dropped.
   * Interacts with: setScope; InventoryApiService.getCategory (pending stub); real InventoryStore.
   * Data: p1's networks pending while the scope moves to p2.
   */
  it('drops what another project read', () => {
    const pending = new Subject<InventoryResult>();
    projectApi.getProjectInventoryNetworks.mockReturnValue(pending);
    service.setScope('p1');
    store.update({ connection: 'lab' });

    service.load(InventoryCategory.Networks).subscribe();
    service.setScope('p2');
    pending.next(
      response({
        items: [{ id: 'n1', name: 'vlan-1', path: 'vlan-1', properties: {} }],
      }),
    );

    expect(store.getValue().connection).toBeNull();
    expect(store.getValue()[InventoryCategory.Networks].items).toEqual([]);
  });

  /**
   * Verifies: a missing or disabled connection is never the default.
   * Interacts with: loadConnections over a project's list.
   * Data: a missing assignment first, then lab-pve (default).
   */
  it("never defaults to a project's missing connection", () => {
    projectApi.getProjectInventoryConnections.mockReturnValue(
      of([
        connection('renamed-away', { status: 'Missing', enabled: false }),
        connection('lab-pve', { isDefault: true }),
      ]),
    );
    service.setScope('p1');

    service.loadConnections().subscribe();

    expect(store.getValue().connection).toBe('lab-pve');
  });

  /**
   * Verifies: if the connections can't be listed, none is named, so the lists read the API's default.
   * Interacts with: InventoryApiService.getConnections (throws).
   * Data: HTTP 500.
   */
  it('names no connection when they cannot be listed', () => {
    apiSpy.getConnections.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const listed = vi.fn();

    service.loadConnections().subscribe(listed);

    expect(listed).toHaveBeenCalledWith([]);
    expect(store.getValue().connection).toBeNull();
  });

  /**
   * Verifies: loads and refresh name the chosen connection.
   * Interacts with: InventoryApiService.getCategory and refresh (stubs).
   * Data: phl-vmc chosen.
   */
  it('reads and refreshes the chosen connection', () => {
    store.update({ connection: 'phl-vmc' });
    apiSpy.getCategory.mockReturnValue(of(response()));

    service.load(InventoryCategory.Networks).subscribe();
    service.refresh().subscribe();

    expect(apiSpy.getCategory).toHaveBeenCalledWith(
      InventoryCategory.Networks,
      'phl-vmc',
    );
    expect(apiSpy.refresh).toHaveBeenCalledWith('phl-vmc');
  });

  /**
   * Verifies: choosing a connection drops the previous connection's lists, and reloads every category from the new one.
   * Interacts with: InventoryApiService.getCategory (stub); real InventoryStore.
   * Data: dev-proxmox's content library marked as not applying, then phl-vmc chosen.
   */
  it('switches every list to a chosen connection', () => {
    store.update({
      connection: 'dev-proxmox',
      [InventoryCategory.ContentLibrary]: {
        ...store.getValue()[InventoryCategory.ContentLibrary],
        applies: false,
        loaded: true,
      },
    });
    const pending = new Subject<InventoryResult>();
    apiSpy.getCategory.mockReturnValue(pending);

    service.selectConnection('phl-vmc').subscribe();

    expect(store.getValue().connection).toBe('phl-vmc');
    // Not loaded yet, and no longer hidden by dev-proxmox's answer.
    expect(store.getValue()[InventoryCategory.ContentLibrary]).toMatchObject({
      applies: true,
      loading: true,
    });
    expect(apiSpy.getCategory).toHaveBeenCalledTimes(
      INVENTORY_CATEGORIES.length,
    );
    expect(
      apiSpy.getCategory.mock.calls.every(([, name]) => name === 'phl-vmc'),
    ).toBe(true);
  });
});
