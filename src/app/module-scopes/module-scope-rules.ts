// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ModuleScope } from '../generated/caster-api';

/**
 * The paths of a Module Scope are module sources' names (cmu), which is all the UI makes. The
 * API also accepts a folder of a source (cmu/exercise-x); the UI leaves a saved one as it is.
 */
export function normalizeScopePath(path: string): string {
  return (path ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

/** The name a source's managed scope is made with, and the description it gets. */
export const MANAGED_DESCRIPTION = 'Managed from the Modules page';

/**
 * The scope that is exactly one source: its only path is the source's name. By convention it is
 * named as the source; one that is, is preferred when several have the same single path.
 */
export function managedScopeOf(
  source: string,
  scopes: readonly ModuleScope[],
): ModuleScope | null {
  const exact = scopes.filter((x) => {
    const paths = (x.paths ?? []).map(normalizeScopePath);
    return paths.length === 1 && paths[0] === source;
  });
  return exact.find((x) => x.name === source) ?? exact[0] ?? null;
}

/** Who may use one module source, worked out from the Module Scopes. */
export interface SourceAccess {
  /** Scopes that allow the whole source. */
  scopes: ModuleScope[];
  /** Projects and project groups, by name, a scope allowing the whole source is assigned to. */
  wholeProjects: string[];
  wholeGroups: string[];
  /** Scopes allowing the whole source that are assigned to no project and no group: inert until assigned. */
  unassigned: ModuleScope[];
  /**
   * Legacy scopes that limit access to folders of the source and do not allow the whole source.
   * They were made before scoping was by source only, and do not count as allowing the source.
   */
  folderScopes: ModuleScope[];
  /** Whether any scope anywhere is assigned: if none is, every project is unrestricted. */
  anyAssigned: boolean;
}

/** The configured source a path belongs to: the longest source name it is or starts with. */
function owningSource(
  path: string,
  sourceNames: readonly string[],
): string | null {
  return (
    [...sourceNames]
      .sort((a, b) => b.length - a.length)
      .find((x) => path === x || path.startsWith(x + '/')) ?? null
  );
}

/**
 * Who may use a source. A project with no scope may use every source, so what a scope gives
 * is access to projects that would otherwise be limited to other sources; what is listed here
 * are the projects and groups a scope allowing this source is assigned to. A scope whose
 * path is a folder of the source (a legacy entry) is kept apart and does not allow it. A path
 * belongs to the longest configured source name it starts with.
 */
export function sourceAccess(
  source: string,
  sourceNames: readonly string[],
  scopes: readonly ModuleScope[],
): SourceAccess {
  const whole: ModuleScope[] = [];
  const folderScopes: ModuleScope[] = [];

  for (const scope of scopes) {
    const paths = (scope.paths ?? [])
      .map(normalizeScopePath)
      .filter((x) => owningSource(x, sourceNames) === source);
    if (paths.includes(source)) {
      whole.push(scope);
    } else if (paths.length) {
      folderScopes.push(scope);
    }
  }

  const sorted = (names: Iterable<[string, string]>) =>
    [...new Map(names).values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );

  return {
    scopes: whole,
    wholeProjects: sorted(
      whole.flatMap((s) =>
        (s.projects ?? []).map((x): [string, string] => [
          x.projectId,
          x.name ?? '',
        ]),
      ),
    ),
    wholeGroups: sorted(
      whole.flatMap((s) =>
        (s.projectGroups ?? []).map((x): [string, string] => [
          x.projectGroupId,
          x.name ?? '',
        ]),
      ),
    ),
    unassigned: whole.filter(
      (x) => !x.projects?.length && !x.projectGroups?.length,
    ),
    folderScopes,
    anyAssigned: scopes.some(
      (x) => !!x.projects?.length || !!x.projectGroups?.length,
    ),
  };
}

/** What a source's row says about who may use it. */
export interface AccessSummary {
  kind: 'open' | 'unscoped' | 'allowed';
  text: string;
  /** A second line: what else matters, such as a scope that is assigned to nothing. */
  note: string | null;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function who(projects: readonly string[], groups: readonly string[]): string {
  return [
    projects.length ? count(projects.length, 'project', 'projects') : '',
    groups.length ? count(groups.length, 'group', 'groups') : '',
  ]
    .filter((x) => !!x)
    .join(', ');
}

/**
 * The short summary for a source's row. "Open to every project" is only said while no scope is
 * assigned anywhere; once one is, a source nothing allows is left to the projects with no scope.
 * A legacy scope limiting access to folders of the source is not counted: see folderScopesNote.
 */
export function accessSummary(access: SourceAccess): AccessSummary {
  const whole = who(access.wholeProjects, access.wholeGroups);
  const unassigned = access.unassigned.length
    ? `${access.unassigned.map((x) => x.name).join(', ')} ${access.unassigned.length === 1 ? 'allows' : 'allow'} it but ${access.unassigned.length === 1 ? 'is' : 'are'} not assigned to any project or group.`
    : null;

  if (whole) {
    return { kind: 'allowed', text: `Allowed for ${whole}`, note: unassigned };
  }

  return access.anyAssigned
    ? {
        kind: 'unscoped',
        text: 'Only projects with no scope',
        note: unassigned,
      }
    : { kind: 'open', text: 'Open to every project', note: unassigned };
}

/**
 * The muted line for legacy scopes that limit access to folders of the source, so they do not
 * disappear from view; null when there are none.
 */
export function folderScopesNote(access: SourceAccess): string | null {
  const n = access.folderScopes.length;
  return n
    ? `${n} ${n === 1 ? 'scope limits' : 'scopes limit'} access to folders of this source.`
    : null;
}
