// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Read-only infrastructure inventory (vCenter) models.
 *
 * These mirror the `/api/inventory/*` contract by hand because the generated
 * client in `src/app/generated/caster-api` does not yet contain these
 * endpoints. See `inventory-api.service.ts` for the replacement plan.
 */

/** A single inventory object, e.g. one VM template or one ISO. */
export interface InventoryItem {
  id: string;
  name: string;
  path: string;
  properties: { [key: string]: string };
  /**
   * Terraform that references the item, ready to paste, keyed by the provider
   * source it is written for, e.g. "bpg/proxmox". Absent or empty for items
   * that are not referenced this way.
   */
  terraform?: { [provider: string]: string };
}

/** The payload returned by every inventory GET endpoint. */
export interface InventoryResponse {
  items: InventoryItem[];
  lastUpdated: string | null;
  /**
   * False is a NORMAL condition, not a failure. The feature is off by default
   * and most deployments have no vCenter credentials configured. When false,
   * `error` carries a human-readable explanation to show the user.
   */
  available: boolean;
  /**
   * False when the provider has no such kind of object, e.g. content libraries
   * on Proxmox. The panel leaves such a category out instead of listing it as
   * unavailable.
   */
  applies: boolean;
  /**
   * True when the latest read failed and `items` are from the last read that
   * succeeded, at `lastUpdated`. `error` says why the latest read failed.
   */
  stale: boolean;
  error: string | null;
}

/**
 * The inventory kinds. The string values double as keys into
 * `InventoryState`, so they must stay in sync with the store shape.
 */
export enum InventoryCategory {
  VmTemplates = 'vmTemplates',
  Isos = 'isos',
  Networks = 'networks',
  Datastores = 'datastores',
  ContentLibrary = 'contentLibrary',
}

/** Per-category slice of the store. Each category loads and fails on its own. */
export interface InventoryCategoryState extends InventoryResponse {
  loading: boolean;
  /** True once a load has resolved one way or the other. */
  loaded: boolean;
  /**
   * True only when the HTTP call itself failed (offline, 5xx, endpoint
   * missing). This is distinct from `available === false`, which is the API
   * telling us the feature is simply not configured.
   */
  loadFailed: boolean;
}

/** Static display metadata for a category. */
export interface InventoryCategoryDescriptor {
  category: InventoryCategory;
  label: string;
  /** Material Design Icons font icon name. */
  icon: string;
  /** Shown when the API reports the category is unavailable with no message. */
  fallbackUnavailableMessage: string;
}

export const INVENTORY_CATEGORIES: InventoryCategoryDescriptor[] = [
  {
    category: InventoryCategory.VmTemplates,
    label: 'VM Templates',
    icon: 'mdi-cube-outline',
    fallbackUnavailableMessage: 'VM template inventory is not configured.',
  },
  {
    category: InventoryCategory.Isos,
    label: 'ISOs',
    icon: 'mdi-disc',
    fallbackUnavailableMessage: 'ISO inventory is not configured.',
  },
  {
    category: InventoryCategory.Networks,
    label: 'Networks',
    icon: 'mdi-lan',
    fallbackUnavailableMessage: 'Network inventory is not configured.',
  },
  {
    category: InventoryCategory.Datastores,
    label: 'Datastores',
    icon: 'mdi-database',
    fallbackUnavailableMessage: 'Datastore inventory is not configured.',
  },
  {
    category: InventoryCategory.ContentLibrary,
    label: 'Content Library',
    icon: 'mdi-bookshelf',
    fallbackUnavailableMessage: 'Content library inventory is not configured.',
  },
];

/** A configured connection, as `GET /api/inventory/connections` lists it. */
export interface InventoryConnection {
  name: string;
  provider: string;
  enabled: boolean;
  /** True for the connection the top-level Infrastructure settings configure. */
  isDefault: boolean;
  lastUpdated: string | null;
}

/** How full something is. Sizes are bytes. */
export interface InventoryUsage {
  used: number;
  total: number;
  /** 0 to 100, rounded. */
  percent: number;
}

/** A hypervisor host's state and use, read from its properties. */
export interface InventoryHostUsage {
  status: string | null;
  /** False for a host that reports itself offline; it has no figures. */
  online: boolean;
  cpuCount: number | null;
  /** Cpu use across all cores, 0 to 100, or null when not reported. */
  cpuPercent: number | null;
  memory: InventoryUsage | null;
}

function numberProperty(item: InventoryItem, key: string): number | null {
  const raw = item.properties?.[key];
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function usage(used: number | null, total: number | null): InventoryUsage | null {
  if (used === null || total === null || total <= 0) {
    return null;
  }
  return {
    used,
    total,
    percent: Math.min(100, Math.max(0, Math.round((used / total) * 100))),
  };
}

/**
 * A datastore's use, from the `capacity` and `freeSpace` properties both
 * providers set. Null when the provider did not report them.
 */
export function datastoreUsage(item: InventoryItem): InventoryUsage | null {
  const capacity = numberProperty(item, 'capacity');
  const free = numberProperty(item, 'freeSpace');
  return usage(
    capacity === null || free === null ? null : capacity - free,
    capacity
  );
}

/** Host states that mean the host is not serving VMs. */
const OFFLINE_STATES = ['offline', 'disconnected', 'notresponding'];

/**
 * A host's use, from the properties `GET /api/inventory/hosts` sets in the same
 * units for both providers: `cpu` as a fraction of `maxcpu` cores, and `mem`
 * and `maxmem` in bytes. A Proxmox node reports `status`; an ESXi host
 * reports `connectionState` instead.
 */
export function hostUsage(item: InventoryItem): InventoryHostUsage {
  const status =
    item.properties?.['status'] || item.properties?.['connectionState'] || null;
  const cpu = numberProperty(item, 'cpu');

  return {
    status,
    online: status === null || !OFFLINE_STATES.includes(status.toLowerCase()),
    cpuCount: numberProperty(item, 'maxcpu'),
    cpuPercent:
      cpu === null ? null : Math.min(100, Math.max(0, Math.round(cpu * 100))),
    memory: usage(numberProperty(item, 'mem'), numberProperty(item, 'maxmem')),
  };
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/**
 * Bytes in binary units, the way vCenter and Proxmox show sizes, e.g.
 * 45558530048 is "42.4 GB".
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const unit = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, unit);
  return `${unit === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

/**
 * A readable name for an item whose name is an id, e.g. a Proxmox vnet's alias
 * or a bridge's comment. Null when there is none, or it only repeats the name.
 */
export function inventoryItemLabel(item: InventoryItem): string | null {
  const label = item.properties?.['alias'] || item.properties?.['comment'];
  return label && label !== item.name ? label : null;
}

/**
 * Case-insensitive match of a search term against an item's name, path and
 * property values.
 */
export function inventoryItemMatches(
  item: InventoryItem,
  term: string
): boolean {
  if (!term) {
    return true;
  }
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (item.name && item.name.toLowerCase().includes(needle)) {
    return true;
  }
  if (item.path && item.path.toLowerCase().includes(needle)) {
    return true;
  }
  return Object.values(item.properties || {}).some(
    (value) => !!value && value.toLowerCase().includes(needle)
  );
}
