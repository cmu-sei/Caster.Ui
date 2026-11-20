// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Module,
  ModuleScope,
  ModuleSource,
} from 'src/app/generated/caster-api';
import {
  AccessSummary,
  accessSummary,
  UNASSIGNED_ACCESS,
  folderScopesNote,
  owningSource,
  sourceAccess,
} from 'src/app/module-scopes/module-scope-rules';

/** The provider name of the legacy GitLab source. */
export const GITLAB_PROVIDER = 'gitlab';

/** The name the group of leftovers is shown under. */
export const LEFTOVER_TITLE = 'Not in a configured source';

/** The key the group of leftovers is expanded under; no source can be named like this. */
export const LEFTOVER_KEY = '\u0000not-in-a-configured-source';

/** The page sizes a source's Modules table offers; the first is the default. */
export const MODULE_PAGE_SIZES = [10, 20, 50, 100];

/**
 * A Module as the page shows it: with the name of its highest version, the
 * configured source it came from (empty when none), and whether it is a
 * leftover: no longer found in its source.
 */
export interface ModuleRow extends Module {
  source: string;
  latestVersion: string;
  leftover: boolean;
}

/** When an API instance last synced a source, in the viewer's time zone. */
export function formatSyncTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function isGitlabSource(source: ModuleSource): boolean {
  return source.provider?.toLowerCase() === GITLAB_PROVIDER;
}

/**
 * The configured source a Module came from. A git source's Modules have Paths
 * of <sourceName> or <sourceName>/<subdirectory>, and a Module belongs to the
 * longest source name that is a whole leading segment of its Path, the rule scope
 * paths use too, so cmu does not own cmu2/x, and a source named `a/b` is not
 * mistaken for a folder of `a`. Names are compared ignoring case here, as the page
 * always has. The legacy GitLab source's Modules use the project's own path,
 * and the API does not say which source a Module came from, so any other Module
 * is the GitLab source's when one is configured. Null when no configured source
 * provides the Module.
 */
export function moduleSourceOf(
  module: Module,
  sources: ModuleSource[],
): ModuleSource | null {
  const git = sources.filter((s) => !isGitlabSource(s) && s.name);
  const name = owningSource(
    module.path ?? '',
    git.map((s) => s.name),
    true,
  );
  const named = git.find((s) => s.name === name);

  return named ?? sources.find(isGitlabSource) ?? null;
}

/** When the Module stopped being found in its source (ISO), or null while it is still there. */
export function missingSinceOf(module: Module): string | null {
  return module.missingSince ?? null;
}

/** Whether the API says whether the Module is still in its source (an older API does not). */
export function reportsSourcePresence(module: Module): boolean {
  return module.missingSince !== undefined || module.inSource !== undefined;
}

/** A Module is a leftover when the API says it is no longer in its source. */
export function isLeftover(module: Module): boolean {
  return !!module.missingSince || module.inSource === false;
}

export function toModuleRow(
  module: Module,
  sources: ModuleSource[],
): ModuleRow {
  const source = moduleSourceOf(module, sources)?.name ?? '';
  return {
    ...module,
    source,
    // The API names the highest version, and has none for a Module without versions.
    latestVersion: module.latestVersion ?? '',
    // A Module no configured source owns is one too: its source is never read again.
    leftover: isLeftover(module) || !source,
  };
}

/** Every Module, under the configured source it belongs to, or with the leftovers. */
export interface ModuleGroups {
  /** By source name; every configured source has an entry, empty when it has no Modules. */
  bySource: Map<string, ModuleRow[]>;
  /** Leftovers, and Modules of no configured source. */
  leftovers: ModuleRow[];
}

const byName = (a: ModuleRow, b: ModuleRow) =>
  (a.name ?? '').localeCompare(b.name ?? '') ||
  (a.path ?? '').localeCompare(b.path ?? '');

/** Groups the Modules by source, each group sorted by name. */
export function groupModules(
  modules: readonly Module[],
  sources: ModuleSource[],
): ModuleGroups {
  const bySource = new Map<string, ModuleRow[]>(
    sources.map((s) => [s.name, []]),
  );
  const leftovers: ModuleRow[] = [];
  for (const module of modules) {
    const row = toModuleRow(module, sources);
    const group = row.leftover ? undefined : bySource.get(row.source);
    (group ?? leftovers).push(row);
  }
  for (const rows of bySource.values()) {
    rows.sort(byName);
  }
  leftovers.sort(byName);
  return { bySource, leftovers };
}

/** Whether a Module matches the search on its name, path, description or latest version. */
export function moduleMatches(row: ModuleRow, term: string): boolean {
  return [row.name, row.path, row.description, row.latestVersion]
    .filter((value) => !!value)
    .some((value) => value.toLowerCase().includes(term));
}

/** What the page shows for one source, or for the leftovers. */
export interface GroupView {
  /** The Modules to list: the matching ones while searching, else all of them. */
  modules: ModuleRow[];
  /** How many Modules the source has, whatever the search. */
  total: number;
  /** A Module matched the search, so the group is opened regardless of what was expanded before. */
  forceOpen: boolean;
}

export interface SourceView extends GroupView {
  source: ModuleSource;
}

export interface GroupedView {
  /** The sources to show, sorted by name. */
  sources: SourceView[];
  /** The group of leftovers; null when there is nothing to show in it. */
  leftovers: GroupView | null;
}

/**
 * What to show for a search. With no search, every source (sorted by name) and
 * the leftover group when it has Modules. With one, only sources that match:
 * those with Modules that match, which are shown with just those Modules and
 * opened, and those whose own name matches, which show all their Modules and
 * stay as they were. The leftover group is shown when one of its Modules matches.
 */
export function viewGroups(
  sources: readonly ModuleSource[],
  groups: ModuleGroups,
  search: string,
): GroupedView {
  const term = search.trim().toLowerCase();
  const sorted = [...sources].sort((a, b) => a.name.localeCompare(b.name));
  const result: SourceView[] = [];

  for (const source of sorted) {
    const all = groups.bySource.get(source.name) ?? [];
    if (!term) {
      result.push({
        source,
        modules: all,
        total: all.length,
        forceOpen: false,
      });
      continue;
    }
    const matching = all.filter((m) => moduleMatches(m, term));
    if (matching.length) {
      result.push({
        source,
        modules: matching,
        total: all.length,
        forceOpen: true,
      });
    } else if (source.name.toLowerCase().includes(term)) {
      result.push({
        source,
        modules: all,
        total: all.length,
        forceOpen: false,
      });
    }
  }

  const leftovers = term
    ? groups.leftovers.filter((m) => moduleMatches(m, term))
    : groups.leftovers;
  return {
    sources: result,
    leftovers: leftovers.length
      ? {
          modules: leftovers,
          total: groups.leftovers.length,
          forceOpen: !!term,
        }
      : null,
  };
}

/** Sorts a source's Modules by a column; the order they came in with no direction. */
export function sortModules(
  rows: readonly ModuleRow[],
  active: string,
  direction: 'asc' | 'desc' | '',
): ModuleRow[] {
  if (!active || !direction) {
    return [...rows];
  }
  const sign = direction === 'asc' ? 1 : -1;
  const value = (row: ModuleRow): string => {
    const cell = (row as unknown as Record<string, unknown>)[active];
    return typeof cell === 'string' ? cell : '';
  };
  return [...rows].sort(
    (a, b) =>
      sign * value(a).localeCompare(value(b), undefined, { numeric: true }),
  );
}

/** What a source's row says about who may use it, and who by name for its tooltip. */
export interface SourceAccessRow {
  summary: AccessSummary;
  tooltip: string;
  /** A shared source: every project may use it, so there is nothing to assign. */
  shared: boolean;
  /** A muted line about legacy scopes limiting access to folders of the source, or null. */
  folderNote: string | null;
  /** The names of those scopes, for the note's tooltip. */
  folderTooltip: string;
}

/** What a shared source's row and tooltip say. */
export const SHARED_TOOLTIP = 'Shared source: every project can use it';

/** Each source's access summary, by name. */
export function sourceAccessRows(
  sources: readonly ModuleSource[],
  scopes: ModuleScope[],
): Map<string, SourceAccessRow> {
  const names = sources.map((s) => s.name);
  return new Map(
    sources.map((s): [string, SourceAccessRow] => {
      if (s.shared) {
        return [
          s.name,
          {
            summary: {
              kind: 'open',
              text: 'Open to every project',
              note: null,
            },
            tooltip: SHARED_TOOLTIP,
            shared: true,
            folderNote: null,
            folderTooltip: '',
          },
        ];
      }
      const access = sourceAccess(s.name, names, scopes);
      const summary = accessSummary(access);
      const parts = [
        access.wholeProjects.length
          ? `Projects: ${access.wholeProjects.join(', ')}.`
          : '',
        access.wholeGroups.length
          ? `Project groups: ${access.wholeGroups.join(', ')}.`
          : '',
        summary.note ?? '',
        ...(access.inheritedScopes.length
          ? [
              `Also allowed through a parent path by ${access.inheritedScopes.map((x) => x.name).join(', ')}.`,
            ]
          : []),
        UNASSIGNED_ACCESS,
      ];
      return [
        s.name,
        {
          summary,
          tooltip: parts.filter((x) => !!x).join(' '),
          shared: false,
          folderNote: folderScopesNote(access),
          folderTooltip: access.folderScopes.map((x) => x.name).join(', '),
        },
      ];
    }),
  );
}

/** What a source's row says about its last read. */
export interface SourceStatus {
  kind: 'ok' | 'empty' | 'warning' | 'failed' | 'pending';
  icon: string;
  /** The short word beside the icon. It has no time: that is in the Last Updated column. */
  word: string;
  /** A helpful second line, such as the error or the API's message, without times; null when there is none. */
  detail: string | null;
  /** What the icon means, for its tooltip and screen readers. */
  reason: string;
}

/** What each status icon means. */
export const STATUS_LABELS: Record<SourceStatus['kind'], string> = {
  ok: 'Read successfully',
  empty: 'No Modules yet',
  warning: 'Needs attention',
  failed: "Couldn't be read",
  pending: 'Not read yet',
};

/** What a source says about its last read. */
export function sourceStatus(source: ModuleSource): SourceStatus {
  // The API's state, when it reports one; older APIs only set error.
  const { state, message } = source;
  if (state === 'Empty') {
    return {
      kind: 'empty',
      icon: 'mdi-folder-outline',
      word: 'Empty',
      detail: message || 'No Modules yet.',
      reason: STATUS_LABELS.empty,
    };
  }
  if (state === 'Warning') {
    return {
      kind: 'warning',
      icon: 'mdi-alert-outline',
      word: 'Warning',
      detail: message || 'Needs attention.',
      reason: STATUS_LABELS.warning,
    };
  }
  if (state === 'Error' || source.error) {
    return {
      kind: 'failed',
      icon: 'mdi-alert-circle-outline',
      word: 'Last sync failed',
      detail: source.error || message || null,
      reason: source.lastSuccess
        ? `${STATUS_LABELS.failed}. Showing its Modules from ${formatSyncTime(source.lastSuccess)}.`
        : STATUS_LABELS.failed,
    };
  }
  return source.lastSuccess
    ? {
        kind: 'ok',
        icon: 'mdi-check-circle-outline',
        word: 'Updated',
        detail: message || null,
        reason: STATUS_LABELS.ok,
      }
    : {
        kind: 'pending',
        icon: 'mdi-clock-outline',
        word: 'Not read yet',
        detail: message || null,
        reason: STATUS_LABELS.pending,
      };
}

/**
 * One row of the page's table: a configured source, or with no source the
 * group of Modules that no configured source provides.
 */
export interface SourceTableRow extends GroupView {
  /** The source's name, or LEFTOVER_KEY: what its expansion is remembered under. */
  key: string;
  /** What the row is called. */
  name: string;
  /** The configured source; null for the leftover group. */
  source: ModuleSource | null;
  status: SourceStatus | null;
  /** Who may use the source; null for the leftovers and while the scopes are not known. */
  access: SourceAccessRow | null;
  /** The id of the row's detail, which its expand button controls. */
  detailId: string;
}

/** The table's rows for a view: the sources as they are sorted, then the leftover group. */
export function sourceTableRows(
  view: GroupedView,
  access: ReadonlyMap<string, SourceAccessRow> | null,
): SourceTableRow[] {
  const rows: SourceTableRow[] = view.sources.map((item, index) => ({
    ...item,
    key: item.source.name,
    name: item.source.name,
    status: sourceStatus(item.source),
    access: access?.get(item.source.name) ?? null,
    detailId: `source-modules-${index}`,
  }));
  if (view.leftovers) {
    rows.push({
      ...view.leftovers,
      key: LEFTOVER_KEY,
      name: LEFTOVER_TITLE,
      source: null,
      status: null,
      access: null,
      detailId: 'source-modules-leftovers',
    });
  }
  return rows;
}

/**
 * Sorts the table's rows by a column, by name on a tie. The leftover group
 * stays last whatever the column or direction, as it is not a source. With
 * no direction the rows keep the order they came in.
 */
export function sortSourceRows(
  rows: readonly SourceTableRow[],
  active: string,
  direction: 'asc' | 'desc' | '',
): SourceTableRow[] {
  const configured = rows.filter((r) => r.source);
  const leftovers = rows.filter((r) => !r.source);
  if (active && direction) {
    const sign = direction === 'asc' ? 1 : -1;
    const value = (row: SourceTableRow): string | number => {
      switch (active) {
        case 'status':
          return row.status?.word ?? '';
        case 'modules':
          return row.total;
        case 'access':
          return row.access?.summary.text ?? '';
        case 'lastSuccess':
          return row.source?.lastSuccess
            ? Date.parse(row.source.lastSuccess)
            : 0;
        default:
          return row.name;
      }
    };
    const compare = (a: string | number, b: string | number) =>
      typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true });
    configured.sort(
      (a, b) =>
        sign * compare(value(a), value(b)) || a.name.localeCompare(b.name),
    );
  }
  return [...configured, ...leftovers];
}
