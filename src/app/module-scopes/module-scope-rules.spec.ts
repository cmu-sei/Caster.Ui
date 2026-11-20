// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Module, ModuleScope } from '../generated/caster-api';
import {
  accessSummary,
  folderScopesNote,
  isOutsideScopes,
  managedScopeOf,
  normalizeScopePath,
  offeredModules,
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

describe('the Modules a project is offered', () => {
  const stored: Module[] = [
    { id: 'm1', name: 'one' },
    { id: 'm2', name: 'two' },
    { id: 'm3', name: 'three' },
  ];

  /**
   * Verifies: only the stored Modules the API listed for the project are offered, because the store keeps every Module any page loaded.
   * Interacts with: offeredModules (pure).
   * Data: three stored modules, two of them listed.
   */
  it('offers only the stored modules the API listed', () => {
    expect(
      offeredModules(stored, new Set(['m1', 'm3'])).map((x) => x.id),
    ).toEqual(['m1', 'm3']);
  });

  /**
   * Verifies: nothing is offered before the project's list has loaded, rather than the whole store.
   * Interacts with: offeredModules (pure).
   * Data: a null list.
   */
  it('offers nothing until the list has loaded', () => {
    expect(offeredModules(stored, null)).toEqual([]);
  });

  /**
   * Verifies: a Design's Module is flagged outside the scopes only once the list has loaded and lacks it.
   * Interacts with: isOutsideScopes (pure).
   * Data: a loaded list without m2; a null list.
   */
  it('flags a module outside the list, but not before it has loaded', () => {
    expect(isOutsideScopes('m2', new Set(['m1']))).toBe(true);
    expect(isOutsideScopes('m1', new Set(['m1']))).toBe(false);
    expect(isOutsideScopes('m2', null)).toBe(false);
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
      text: 'Open to every project',
      note: null,
    });
  });

  /**
   * Verifies: a scope that covers only other sources leaves this one to the projects with no scope, not open to every project.
   * Interacts with: sourceAccess and accessSummary (pure).
   * Data: a scope for sei assigned to one project.
   */
  it('is left to projects with no scope when scopes cover other sources only', () => {
    expect(summary('cmu', [scope(['sei'], ['Alpha'])])).toEqual({
      kind: 'unscoped',
      text: 'Only projects with no scope',
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
      text: 'Only projects with no scope',
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
      text: 'Open to every project',
      note: 'Scope cmu allows it but is not assigned to any project or group.',
    });
  });
});
