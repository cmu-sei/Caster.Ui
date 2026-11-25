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
  /** Scopes that allow the whole source, by its name or through a parent path. */
  scopes: ModuleScope[];
  /** Those of them that allow it only through a parent path (the path cmu for the source cmu/lab). */
  inheritedScopes: ModuleScope[];
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

/**
 * The configured source a path belongs to: the longest source name that is the path, or a whole
 * leading segment of it (cmu owns cmu and cmu/lab, never cmu2). Scope paths are compared with the
 * exact case, as the API matches them. Module paths use ignoreCase, as the page always has: it
 * matched a Module to its source by name, and source names are compared case insensitively.
 */
export function owningSource(
  path: string,
  sourceNames: readonly string[],
  ignoreCase = false,
): string | null {
  const fold = (x: string) => (ignoreCase ? x.toLowerCase() : x);
  const target = fold(path);
  return (
    [...sourceNames]
      .filter((x) => !!x)
      .sort((a, b) => b.length - a.length)
      .find((x) => {
        const name = fold(x);
        return target === name || target.startsWith(name + '/');
      }) ?? null
  );
}

/**
 * Whether a scope allows every Module of a source: one of its paths is the source or a parent of
 * it (the path cmu allows cmu/lab), as the API's whole-segment prefix match does.
 */
export function allowsSource(scope: ModuleScope, source: string): boolean {
  return (scope.paths ?? [])
    .map(normalizeScopePath)
    .some((p) => !!p && (p === source || source.startsWith(p + '/')));
}

/** Whether a scope also allows paths that are not this source's: it covers other sources or folders. */
export function coversOtherPaths(scope: ModuleScope, source: string): boolean {
  return (scope.paths ?? [])
    .map(normalizeScopePath)
    .some((p) => !!p && p !== source);
}

/**
 * Who may use a source. A project with no scope may use every source (only the shared ones when
 * the deployment restricts unassigned projects), so what a scope gives is access to projects that
 * would otherwise be limited to other sources; what is listed here are the projects and groups a
 * scope allowing this source is assigned to. A scope allows the source when one of its paths is
 * the source or a parent of it. A scope whose path is a folder of the source (a legacy entry) is
 * kept apart and does not allow it. A path belongs to the longest configured source name that is
 * a whole leading segment of it.
 */
export function sourceAccess(
  source: string,
  sourceNames: readonly string[],
  scopes: readonly ModuleScope[],
): SourceAccess {
  const whole: ModuleScope[] = [];
  const inherited: ModuleScope[] = [];
  const folderScopes: ModuleScope[] = [];

  for (const scope of scopes) {
    const paths = (scope.paths ?? []).map(normalizeScopePath);
    if (allowsSource(scope, source)) {
      whole.push(scope);
      if (!paths.includes(source)) {
        inherited.push(scope);
      }
    } else if (paths.some((x) => owningSource(x, sourceNames) === source)) {
      folderScopes.push(scope);
    }
  }

  const sorted = (names: Iterable<[string, string]>) =>
    [...new Map(names).values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );

  return {
    scopes: whole,
    inheritedScopes: inherited,
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
 * What a project with no scope assigned can use. The page cannot know whether the deployment
 * restricts such projects (it is a setting of the API), so every place that talks about it says
 * both.
 */
export const UNASSIGNED_ACCESS =
  'A project with no sources assigned can use every source (or only shared sources if the deployment restricts them).';

/** The short summary for a source's row when no project or group is assigned to it. */
export const UNASSIGNED_SUMMARY =
  'Open to every project that has no source assigned (unless the deployment restricts them to shared sources)';

/**
 * The short summary for a source's row: the projects and groups it is assigned to, or when there
 * are none that it is open to projects with nothing assigned, which is as far as the page can
 * tell, since the deployment may restrict those to the shared sources. A legacy scope limiting
 * access to folders of the source is not counted: see folderScopesNote.
 */
export function accessSummary(access: SourceAccess): AccessSummary {
  const whole = who(access.wholeProjects, access.wholeGroups);
  const unassigned = access.unassigned.length
    ? `${access.unassigned.map((x) => x.name).join(', ')} ${access.unassigned.length === 1 ? 'allows' : 'allow'} it but ${access.unassigned.length === 1 ? 'is' : 'are'} not assigned to any project or group.`
    : null;

  if (whole) {
    return { kind: 'allowed', text: `Allowed for ${whole}`, note: unassigned };
  }

  return {
    kind: access.anyAssigned ? 'unscoped' : 'open',
    text: UNASSIGNED_SUMMARY,
    note: unassigned,
  };
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
