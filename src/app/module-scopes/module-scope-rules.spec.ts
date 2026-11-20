// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ModuleScope } from '../generated/caster-api';
import {
  UNASSIGNED_ACCESS,
  UNASSIGNED_SUMMARY,
  accessSummary,
  allowsSource,
  coversOtherPaths,
  folderScopesNote,
  managedScopeOf,
  normalizeScopePath,
  owningSource,
  sourceAccess,
} from './module-scope-rules';

describe('module scope paths', () => {
  /**
   * Verifies: a path is trimmed of white space and of slashes at either end, as the API stores it.
   * Interacts with: normalizeScopePath (pure).
   * Data: padded and slash-wrapped paths.
   */
  it.each([
    ['cmu', 'cmu'],
    ['  cmu/exercise-x/ ', 'cmu/exercise-x'],
    ['/cmu/', 'cmu'],
    ['My Org/team_1.2', 'My Org/team_1.2'],
  ])('normalizes %j to %j', (path, expected) => {
    expect(normalizeScopePath(path)).toBe(expected);
  });
});

describe('managed scopes', () => {
  const scope = (id: string, name: string, paths: string[]): ModuleScope => ({
    id,
    name,
    paths,
  });

  /**
   * Verifies: the managed scope of a source is the one whose only path is the source; one named as the source wins over another with the same path; a multi-path or folder scope is never it.
   * Interacts with: managedScopeOf (pure).
   * Data: scopes for cmu alone twice, cmu with sei, and a cmu folder.
   */
  it('finds the scope that is exactly the source', () => {
    const scopes = [
      scope('a', 'Other name', ['cmu']),
      scope('b', 'cmu', ['cmu']),
      scope('c', 'Both', ['cmu', 'sei']),
      scope('d', 'Folder', ['cmu/x']),
    ];

    expect(managedScopeOf('cmu', scopes)?.id).toBe('b');
    expect(managedScopeOf('cmu', scopes.slice(0, 1))?.id).toBe('a');
    expect(managedScopeOf('sei', scopes)).toBeNull();
  });
});

describe('who may use a source', () => {
  const names = ['cmu', 'sei', 'cmu/lab'];
  const scope = (
    paths: string[],
    projects: string[] = [],
    groups: string[] = [],
  ): ModuleScope => ({
    id: paths.join('+') + projects.join() + groups.join(),
    name: `Scope ${paths.join('+')}`,
    paths,
    projects: projects.map((x) => ({ projectId: x.toLowerCase(), name: x })),
    projectGroups: groups.map((x) => ({
      projectGroupId: x.toLowerCase(),
      name: x,
    })),
  });
  const summary = (source: string, scopes: ModuleScope[]) =>
    accessSummary(sourceAccess(source, names, scopes));

  /**
   * Verifies: with no scopes at all, a source is open to every project.
   * Interacts with: sourceAccess and accessSummary (pure).
   * Data: no scopes.
   */
  it('is open to every project when there are no scopes', () => {
    expect(summary('cmu', [])).toEqual({
      kind: 'open',
      text: UNASSIGNED_SUMMARY,
      note: null,
    });
  });

  /**
   * Verifies: the summary of an unassigned source names both deployment settings and does not claim the source is open to every project, nor to nobody.
   * Interacts with: accessSummary (pure).
   * Data: no scopes.
   */
  it('words an unassigned source so it holds under both deployment settings', () => {
    const text = summary('cmu', []).text;

    expect(text).toBe(
      'Open to every project that has no source assigned (unless the deployment restricts them to shared sources)',
    );
    expect(UNASSIGNED_ACCESS).toBe(
      'A project with no sources assigned can use every source (or only shared sources if the deployment restricts them).',
    );
  });

  /**
   * Verifies: a scope that covers only other sources leaves this one to the projects with no scope, not open to every project.
   * Interacts with: sourceAccess and accessSummary (pure).
   * Data: a scope for sei assigned to one project.
   */
  it('is left to projects with no scope when scopes cover other sources only', () => {
    expect(summary('cmu', [scope(['sei'], ['Alpha'])])).toEqual({
      kind: 'unscoped',
      text: UNASSIGNED_SUMMARY,
      note: null,
    });
  });

  /**
   * Verifies: the summary counts the projects and groups of scopes that allow the whole source, once each however many scopes name them.
   * Interacts with: sourceAccess and accessSummary (pure).
   * Data: two scopes for cmu sharing project Alpha.
   */
  it('counts projects and groups of scopes allowing the whole source', () => {
    const scopes = [
      scope(['cmu'], ['Alpha', 'Beta'], ['Cyber']),
      scope(['cmu'], ['Alpha', 'Gamma']),
    ];
    expect(summary('cmu', scopes).text).toBe('Allowed for 3 projects, 1 group');
    expect(sourceAccess('cmu', names, scopes).wholeProjects).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
  });

  /**
   * Verifies: a legacy scope for a folder of the source is not counted as allowing the source, even for a project a whole-source scope also reaches.
   * Interacts with: sourceAccess and accessSummary (pure).
   * Data: Alpha has cmu whole, Alpha and Beta have cmu/exercise-x.
   */
  it('does not count a folder scope as allowing the source', () => {
    const scopes = [
      scope(['cmu'], ['Alpha']),
      scope(['cmu/exercise-x'], ['Alpha', 'Beta']),
    ];
    const access = sourceAccess('cmu', names, scopes);

    expect(accessSummary(access).text).toBe('Allowed for 1 project');
    expect(access.scopes.map((x) => x.name)).toEqual(['Scope cmu']);
    expect(access.folderScopes.map((x) => x.name)).toEqual([
      'Scope cmu/exercise-x',
    ]);
  });

  /**
   * Verifies: with only a folder scope the source is left to projects with no scope, and a note says one scope limits access to folders; the note is plural for several and absent for none.
   * Interacts with: sourceAccess, accessSummary and folderScopesNote (pure).
   * Data: one then two folder scopes of cmu, and none.
   */
  it('says folder scopes in a muted note, not in the summary', () => {
    const one = sourceAccess('cmu', names, [
      scope(['cmu/exercise-x'], [], ['Cyber']),
    ]);
    expect(accessSummary(one)).toEqual({
      kind: 'unscoped',
      text: UNASSIGNED_SUMMARY,
      note: null,
    });
    expect(folderScopesNote(one)).toBe(
      '1 scope limits access to folders of this source.',
    );

    const two = sourceAccess('cmu', names, [
      scope(['cmu/a'], ['Alpha']),
      scope(['cmu/b']),
    ]);
    expect(folderScopesNote(two)).toBe(
      '2 scopes limit access to folders of this source.',
    );
    expect(folderScopesNote(sourceAccess('cmu', names, []))).toBeNull();
  });

  /**
   * Verifies: a scope holding both the source and one of its folders counts as allowing the source and adds no folder note.
   * Interacts with: sourceAccess and folderScopesNote (pure).
   * Data: one scope with cmu and cmu/exercise-x.
   */
  it('treats a scope with the source itself as allowing it', () => {
    const access = sourceAccess('cmu', names, [
      scope(['cmu', 'cmu/exercise-x'], ['Alpha']),
    ]);

    expect(access.wholeProjects).toEqual(['Alpha']);
    expect(folderScopesNote(access)).toBeNull();
  });

  /**
   * Verifies: a path belongs to the longest configured source name, so cmu/lab/x is a folder of the source cmu/lab and not of cmu; unknown paths count for nothing.
   * Interacts with: sourceAccess (pure).
   * Data: sources cmu and cmu/lab.
   */
  it('gives a path to the longest source it starts with', () => {
    const scopes = [
      scope(['cmu/lab/x'], ['Alpha']),
      scope(['nowhere'], ['Beta']),
    ];
    expect(
      sourceAccess('cmu/lab', names, scopes).folderScopes.map((x) => x.name),
    ).toEqual(['Scope cmu/lab/x']);
    expect(sourceAccess('cmu', names, scopes).folderScopes).toEqual([]);
    expect(sourceAccess('cmu', names, scopes).scopes).toEqual([]);
    expect(sourceAccess('sei', names, scopes).scopes).toEqual([]);
  });

  /**
   * Verifies: a scope that allows the source but is assigned to nothing is named in a note, and does not count as restricting anything.
   * Interacts with: sourceAccess and accessSummary (pure).
   * Data: one unassigned scope for cmu.
   */
  it('notes a scope that is assigned to nothing', () => {
    expect(summary('cmu', [scope(['cmu'])])).toEqual({
      kind: 'open',
      text: UNASSIGNED_SUMMARY,
      note: 'Scope cmu allows it but is not assigned to any project or group.',
    });
  });
});

describe('which source a path belongs to', () => {
  const names = ['cmu', 'cmu2', 'cmu/lab', 'sei'];

  /**
   * Verifies: a path belongs to the longest source name that is the path or a whole leading segment of it, never to a name that is only a partial prefix.
   * Interacts with: owningSource (pure).
   * Data: sources cmu, cmu2, cmu/lab and sei.
   */
  it.each([
    ['cmu', 'cmu'],
    ['cmu/x', 'cmu'],
    ['cmu2', 'cmu2'],
    ['cmu2/x', 'cmu2'],
    ['cmu/lab/x', 'cmu/lab'],
    ['cmux/y', null],
    ['cm', null],
    ['', null],
  ])('gives %j to %j', (path, expected) => {
    expect(owningSource(path, names)).toBe(expected);
  });

  /**
   * Verifies: scope paths are matched with the exact case, as the API does; module paths can opt into ignoring case.
   * Interacts with: owningSource (pure).
   * Data: the path CMU/x against the source cmu.
   */
  it('matches the exact case unless asked to ignore it', () => {
    expect(owningSource('CMU/x', names)).toBeNull();
    expect(owningSource('CMU/x', names, true)).toBe('cmu');
  });
});

describe('scopes that allow a source through a parent path', () => {
  const scope = (paths: string[], projects: string[] = []): ModuleScope => ({
    id: paths.join('+') + projects.join(),
    name: `Scope ${paths.join('+')}`,
    paths,
    projects: projects.map((x) => ({ projectId: x.toLowerCase(), name: x })),
    projectGroups: [],
  });
  const names = ['cmu', 'cmu2', 'cmu/lab'];

  /**
   * Verifies: a scope for the path cmu allows the source cmu/lab, as the API's whole-segment prefix match does, and is counted in its summary and marked inherited; a scope for cmu2 or cmu/lab does not allow cmu.
   * Interacts with: sourceAccess, allowsSource and accessSummary (pure).
   * Data: sources cmu, cmu2, cmu/lab; scopes for cmu (Alpha), cmu2 (Beta) and cmu/lab (Gamma).
   */
  it('counts a scope for a parent path as allowing the nested source', () => {
    const scopes = [
      scope(['cmu'], ['Alpha']),
      scope(['cmu2'], ['Beta']),
      scope(['cmu/lab'], ['Gamma']),
    ];

    const lab = sourceAccess('cmu/lab', names, scopes);
    expect(lab.wholeProjects).toEqual(['Alpha', 'Gamma']);
    expect(lab.inheritedScopes.map((x) => x.name)).toEqual(['Scope cmu']);
    expect(accessSummary(lab).text).toBe('Allowed for 2 projects');

    expect(sourceAccess('cmu', names, scopes).wholeProjects).toEqual(['Alpha']);
    expect(sourceAccess('cmu2', names, scopes).wholeProjects).toEqual(['Beta']);
    expect(allowsSource(scopes[0], 'cmu2')).toBe(false);
  });

  /**
   * Verifies: scope paths are compared with the exact case, so CMU does not allow cmu.
   * Interacts with: sourceAccess and allowsSource (pure).
   * Data: a scope for CMU.
   */
  it('does not match a path of another case', () => {
    const scopes = [scope(['CMU'], ['Alpha'])];

    expect(allowsSource(scopes[0], 'cmu')).toBe(false);
    expect(sourceAccess('cmu', names, scopes).wholeProjects).toEqual([]);
  });

  /**
   * Verifies: a scope covers other paths when it has any path besides the source, and not when its only path is the source.
   * Interacts with: coversOtherPaths (pure).
   * Data: scopes for cmu, cmu with sei, and a parent path.
   */
  it('tells whether a scope covers other paths', () => {
    expect(coversOtherPaths(scope(['cmu']), 'cmu')).toBe(false);
    expect(coversOtherPaths(scope(['cmu', 'sei']), 'cmu')).toBe(true);
    expect(coversOtherPaths(scope(['cmu']), 'cmu/lab')).toBe(true);
  });

  /**
   * Verifies: the shared wording for projects with no source assigned names both settings of the deployment.
   * Interacts with: UNASSIGNED_ACCESS (constant).
   * Data: none.
   */
  it('words the unassigned rule for both deployment settings', () => {
    expect(UNASSIGNED_ACCESS).toMatch(/every source/);
    expect(UNASSIGNED_ACCESS).toMatch(
      /only shared sources if the deployment restricts/,
    );
  });
});
