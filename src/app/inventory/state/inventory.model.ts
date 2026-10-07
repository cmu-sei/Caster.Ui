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
}

/** The payload returned by all four inventory GET endpoints. */
export interface InventoryResponse {
  items: InventoryItem[];
  lastUpdated: string | null;
  /**
   * False is a NORMAL condition, not a failure. The feature is off by default
   * and most deployments have no vCenter credentials configured. When false,
   * `error` carries a human-readable explanation to show the user.
   */
  available: boolean;
  error: string | null;
}

/**
 * The four inventory kinds. The string values double as keys into
 * `InventoryState`, so they must stay in sync with the store shape.
 */
export enum InventoryCategory {
  VmTemplates = 'vmTemplates',
  Isos = 'isos',
  Networks = 'networks',
  Datastores = 'datastores',
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
];

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
