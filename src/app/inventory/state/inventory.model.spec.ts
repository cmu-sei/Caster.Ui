// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  datastoreUsage,
  formatBytes,
  hostUsage,
  InventoryItem,
} from './inventory.model';

function item(properties: { [key: string]: string }): InventoryItem {
  return { id: 'x', name: 'x', path: 'x', properties };
}

describe('inventory usage helpers', () => {
  /**
   * Verifies: sizes read in binary units, the way vCenter and Proxmox show them.
   * Data: 0, 512 B, 1.5 KB, the dev Proxmox's 8327024640 bytes of memory, 2 TB.
   */
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [8327024640, '7.8 GB'],
    [2 * 1024 ** 4, '2.0 TB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  /**
   * Verifies: a datastore's use comes from capacity less free space.
   * Data: 1000 bytes with 250 free.
   */
  it('reads datastore use from capacity and free space', () => {
    expect(
      datastoreUsage(item({ capacity: '1000', freeSpace: '250' })),
    ).toEqual({ used: 750, total: 1000, percent: 75 });
  });

  /**
   * Verifies: no figures, a missing half, or a zero capacity give no use rather than 0%.
   * Data: empty, capacity only, capacity 0, a non-numeric value.
   */
  it.each([
    [{}],
    [{ capacity: '1000' }],
    [{ capacity: '0', freeSpace: '0' }],
    [{ capacity: 'lots', freeSpace: '1' }],
  ])('gives no datastore use for %j', (properties) => {
    expect(datastoreUsage(item(properties))).toBeNull();
  });

  /**
   * Verifies: a host's cpu fraction becomes a percent and its memory a use.
   * Data: the dev Proxmox node pve as GET /api/inventory/hosts returns it.
   */
  it('reads a host use from its properties', () => {
    expect(
      hostUsage(
        item({
          status: 'online',
          maxcpu: '4',
          cpu: '0.1',
          maxmem: '8327024640',
          mem: '2351816704',
        }),
      ),
    ).toEqual({
      status: 'online',
      online: true,
      cpuCount: 4,
      cpuPercent: 10,
      memory: { used: 2351816704, total: 8327024640, percent: 28 },
    });
  });

  /**
   * Verifies: an offline host reports no figures, not zeros.
   * Data: status offline and nothing else, as Proxmox lists an offline node.
   */
  it('reads an offline host as offline with no figures', () => {
    expect(hostUsage(item({ status: 'offline' }))).toEqual({
      status: 'offline',
      online: false,
      cpuCount: null,
      cpuPercent: null,
      memory: null,
    });
  });

  /**
   * Verifies: an ESXi host is read in the same units, and its connection state stands in for a status.
   * Data: a vSphere host as GET /api/inventory/hosts returns it, connected and then disconnected.
   */
  it('reads an ESXi host from the same properties, using its connection state', () => {
    expect(
      hostUsage(
        item({
          connectionState: 'connected',
          powerState: 'poweredOn',
          maxcpu: '16',
          cpu: '0.25',
          maxmem: '68719476736',
          mem: '17179869184',
        }),
      ),
    ).toEqual({
      status: 'connected',
      online: true,
      cpuCount: 16,
      cpuPercent: 25,
      memory: { used: 17179869184, total: 68719476736, percent: 25 },
    });
    expect(
      hostUsage(item({ connectionState: 'disconnected' })).online,
    ).toBe(false);
  });
});
