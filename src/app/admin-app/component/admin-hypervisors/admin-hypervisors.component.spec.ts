// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, Mock } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { ApiStub, BodyOverload } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { InventoryService as InventoryApiService } from 'src/app/generated/caster-api';
import { InventoryConnection, InventoryResult } from 'src/app/inventory/state';
import { AdminHypervisorsComponent } from './admin-hypervisors.component';

function response(overrides: Partial<InventoryResult> = {}): InventoryResult {
  return {
    items: [],
    lastUpdated: '2026-10-29T14:00:00Z',
    available: true,
    applies: true,
    enabled: true,
    stale: false,
    error: null,
    ...overrides,
  };
}

function connection(
  overrides: Partial<InventoryConnection> = {},
): InventoryConnection {
  return {
    name: 'Default',
    provider: 'proxmox',
    enabled: true,
    isDefault: true,
    lastUpdated: '2026-10-29T14:00:00Z',
    ...overrides,
  };
}

/** The dev Proxmox node and its storage, as the API returns them. */
const pveHosts = response({
  items: [
    {
      id: 'pve',
      name: 'pve',
      path: 'pve',
      properties: {
        status: 'online',
        maxcpu: '4',
        cpu: '0.1',
        maxmem: '8327024640',
        mem: '2351816704',
      },
    },
    {
      id: 'pve2',
      name: 'pve2',
      path: 'pve2',
      properties: { status: 'offline' },
    },
  ],
});

const pveStorage = response({
  items: [
    {
      id: 'local-lvm',
      name: 'local-lvm',
      path: 'local-lvm',
      properties: {
        type: 'lvmthin',
        capacity: '1000',
        freeSpace: '50',
        shared: 'false',
      },
    },
  ],
});

interface InventoryApiStub {
  getInventoryConnections: Mock<
    BodyOverload<InventoryApiService['getInventoryConnections']>
  >;
  getInventoryHosts: Mock<
    BodyOverload<InventoryApiService['getInventoryHosts']>
  >;
  getInventoryDatastores: Mock<
    BodyOverload<InventoryApiService['getInventoryDatastores']>
  >;
  refreshInventory: Mock<BodyOverload<InventoryApiService['refreshInventory']>>;
}

async function renderPage(api: Partial<InventoryApiStub>) {
  const stub: InventoryApiStub = {
    getInventoryConnections: vi.fn<
      BodyOverload<InventoryApiService['getInventoryConnections']>
    >(() => of([connection()])),
    getInventoryHosts: vi.fn<
      BodyOverload<InventoryApiService['getInventoryHosts']>
    >(() => of(pveHosts)),
    getInventoryDatastores: vi.fn<
      BodyOverload<InventoryApiService['getInventoryDatastores']>
    >(() => of(pveStorage)),
    refreshInventory: vi.fn<
      BodyOverload<InventoryApiService['refreshInventory']>
    >(() => of(null)),
    ...api,
  };
  stub satisfies Partial<ApiStub<InventoryApiService>>;

  const view = await renderComponent(AdminHypervisorsComponent, {
    providers: [{ provide: InventoryApiService, useValue: stub }],
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  return { ...view, api: stub, user: userEvent.setup() };
}

/** A table row's cells, each with its whitespace collapsed. */
function rowText(row: HTMLElement): string {
  return Array.from(row.querySelectorAll('td'))
    .map((cell) => cell.textContent.replace(/\s+/g, ' ').trim())
    .join(' | ');
}

describe('AdminHypervisorsComponent', () => {
  /**
   * Verifies: each host shows its cpu and memory use, and an offline host says so with no figures.
   * Interacts with: InventoryApiService.getConnections and getHosts (stubs).
   * Data: the dev Proxmox node pve at 10% cpu and 2.2 of 7.8 GB, and an offline pve2.
   */
  it('shows each host with its cpu and memory use', async () => {
    const { fixture } = await renderPage({});

    const rows = Array.from(
      fixture.nativeElement
        .querySelectorAll('table')[0]
        .querySelectorAll('tbody tr'),
    ) as HTMLElement[];

    expect(rows.map(rowText)).toEqual([
      'pve | 10% · 4 CPUs | 28% · 2.2 GB of 7.8 GB',
      'pve2 offline | Not reported | Not reported',
    ]);
    expect(rows[1].classList).toContain('offline');
  });

  /**
   * Verifies: storage shows how full it is, and the bar turns red past 90%.
   * Interacts with: InventoryApiService.getCategory (stub) for Datastores on the named connection.
   * Data: local-lvm, 950 of 1000 bytes used.
   */
  it('shows how full each storage is', async () => {
    const { fixture, api } = await renderPage({});

    expect(api.getInventoryDatastores).toHaveBeenCalledWith('Default');
    const row = fixture.nativeElement
      .querySelectorAll('table')[1]
      .querySelector('tbody tr') as HTMLElement;
    expect(rowText(row)).toBe('local-lvm | lvmthin | 95% · 950 B of 1000 B');
    expect(row.querySelector('mat-progress-bar').classList).toContain('high');
  });

  /**
   * Verifies: every configured connection gets its own card, read by name.
   * Interacts with: InventoryApiService.getConnections and getHosts (stubs).
   * Data: the default Proxmox connection and a named vSphere one, lab2.
   */
  it('reads every connection by name', async () => {
    const { api } = await renderPage({
      getInventoryConnections: vi.fn<
        BodyOverload<InventoryApiService['getInventoryConnections']>
      >(() =>
        of([
          connection(),
          connection({ name: 'lab2', provider: 'vsphere', isDefault: false }),
        ]),
      ),
    });

    expect(screen.getByRole('heading', { name: 'Default' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'lab2' })).toBeTruthy();
    expect(screen.getByText('vSphere')).toBeTruthy();
    expect(api.getInventoryHosts.mock.calls.map((c) => c[0])).toEqual([
      'Default',
      'lab2',
    ]);
  });

  /**
   * Verifies: a provider that cannot report host use says why, and storage still shows.
   * Interacts with: InventoryApiService.getHosts (stub).
   * Data: hosts unavailable with the vSphere REST message.
   */
  it('says why host use is not available', async () => {
    await renderPage({
      getInventoryHosts: vi.fn<
        BodyOverload<InventoryApiService['getInventoryHosts']>
      >(() =>
        of(
          response({
            available: false,
            error:
              'Host cpu and memory use is not available from the vSphere Automation REST API.',
          }),
        ),
      ),
    });

    expect(
      screen.getByText(/not available from the vSphere Automation REST API/),
    ).toBeTruthy();
    expect(screen.getByText('local-lvm')).toBeTruthy();
  });

  /**
   * Verifies: a kept earlier read still lists its hosts and says it could not refresh.
   * Interacts with: InventoryApiService.getHosts (stub).
   * Data: hosts stale, with Proxmox's 502.
   */
  it('lists stale hosts and says why they could not refresh', async () => {
    await renderPage({
      getInventoryHosts: vi.fn<
        BodyOverload<InventoryApiService['getInventoryHosts']>
      >(() =>
        of({
          ...pveHosts,
          stale: true,
          error: 'Proxmox returned 502 BadGateway when reading nodes.',
        }),
      ),
    });

    expect(screen.getByText(/Could not refresh.*502 BadGateway/)).toBeTruthy();
    expect(screen.getByText('pve')).toBeTruthy();
  });

  /**
   * Verifies: Refresh re-reads that one connection, then reloads its hosts and storage.
   * Interacts with: InventoryApiService.refresh, getHosts, getCategory (stubs).
   * Data: the default connection.
   */
  it('refreshes one connection', async () => {
    const { api, user } = await renderPage({});
    api.getInventoryHosts.mockClear();

    await user.click(screen.getByRole('button', { name: 'Refresh Default' }));

    expect(api.refreshInventory).toHaveBeenCalledWith('Default');
    expect(api.getInventoryHosts).toHaveBeenCalledWith('Default');
  });

  /**
   * Verifies: a failed hosts request leaves storage showing.
   * Interacts with: InventoryApiService.getHosts (throws).
   * Data: getHosts errors with a 500.
   */
  it('keeps storage when the hosts request fails', async () => {
    await renderPage({
      getInventoryHosts: vi.fn<
        BodyOverload<InventoryApiService['getInventoryHosts']>
      >(() => throwError(() => new HttpErrorResponse({ status: 500 }))),
    });

    expect(screen.getByText('Hosts could not be read right now.')).toBeTruthy();
    expect(screen.getByText('local-lvm')).toBeTruthy();
  });

  /**
   * Verifies: an API without the inventory endpoints says so instead of an empty page.
   * Interacts with: InventoryApiService.getConnections (404).
   * Data: getConnections errors with a 404.
   */
  it('says when the API has no inventory', async () => {
    await renderPage({
      getInventoryConnections: vi.fn<
        BodyOverload<InventoryApiService['getInventoryConnections']>
      >(() => throwError(() => new HttpErrorResponse({ status: 404 }))),
    });

    expect(
      screen.getByText(
        'Hypervisor inventory is not available on this Caster API.',
      ),
    ).toBeTruthy();
  });

  /**
   * Verifies: a misconfigured connection says why and isn't read.
   * Interacts with: InventoryApiService.getInventoryConnections and getInventoryHosts (stubs).
   * Data: one connection whose settings carry an error.
   */
  it('says why a misconfigured connection is not read', async () => {
    const problem =
      "This infrastructure connection is misconfigured, so it isn't read. Infrastructure:Connections:0:Inventory:Resources:Networks:Include is not a valid regular expression.";
    const { api } = await renderPage({
      getInventoryConnections: vi.fn<
        BodyOverload<InventoryApiService['getInventoryConnections']>
      >(() => of([connection({ error: problem })])),
    });

    expect(screen.getByText(problem)).toBeTruthy();
    expect(api.getInventoryHosts).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Hosts' })).toBeNull();
  });

  /**
   * Verifies: a kind the connection's settings turn off has no section.
   * Interacts with: InventoryApiService.getInventoryConnections (stub).
   * Data: a connection that reads datastores but not hosts.
   */
  it('leaves out what the connection does not read', async () => {
    await renderPage({
      getInventoryConnections: vi.fn<
        BodyOverload<InventoryApiService['getInventoryConnections']>
      >(() => of([connection({ resources: ['Datastore'] })])),
    });

    expect(screen.queryByRole('heading', { name: 'Hosts' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Storage' })).toBeTruthy();
  });
});
