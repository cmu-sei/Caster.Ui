// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  Module,
  ModuleScope,
  ModuleSource,
} from 'src/app/generated/caster-api';
import {
  LEFTOVER_KEY,
  LEFTOVER_TITLE,
  ModuleRow,
  groupModules,
  isLeftover,
  moduleMatches,
  moduleSourceOf,
  sortModules,
  sortSourceRows,
  sourceAccessRows,
  sourceStatus,
  sourceTableRows,
  toModuleRow,
  viewGroups,
} from './module-source-groups';

const cmu: ModuleSource = { name: 'cmu', provider: 'git' };
const sei: ModuleSource = { name: 'sei', provider: 'git' };
const extra: ModuleSource = { name: 'cmu/extra', provider: 'git' };
const gitlab: ModuleSource = { name: 'gitlab', provider: 'gitlab' };

const vm: Module = {
  id: '1',
  name: 'machine-blank',
  path: 'sei/machine-blank',
  description: 'Blank VM',
  latestVersion: 'v1.10.0',
};
const exercise: Module = {
  id: '2',
  name: 'exercise-x',
  path: 'cmu/exercise-x',
  latestVersion: 'v2.0.0',
};
const deep: Module = { id: '3', name: 'deep', path: 'cmu/extra/deep' };
const old: Module = {
  id: '4',
  name: 'old',
  path: 'cmu/old',
  missingSince: '2026-11-01T00:00:00Z',
} as Module;
const orphan: Module = { id: '5', name: 'orphan', path: 'uni/orphan' };
const dns: Module = { id: '6', name: 'dns', path: 'group/dns' };

describe('moduleSourceOf', () => {
  /**
   * Verifies: a git source owns the Modules whose Path is its name or starts with its name and a slash, the longest matching name wins, and any other Module is the GitLab source's when one is configured, else no source's.
   * Interacts with: nothing; a pure function.
   * Data: sources cmu, cmu/extra and gitlab; paths in the row.
   */
  it.each([
    { path: 'cmu', sources: [cmu, gitlab], expected: 'cmu' },
    { path: 'cmu/vm', sources: [cmu, gitlab], expected: 'cmu' },
    { path: 'CMU/vm', sources: [cmu, gitlab], expected: 'cmu' },
    { path: 'cmu/extra/vm', sources: [cmu, extra], expected: 'cmu/extra' },
    { path: 'cmuvm/x', sources: [cmu, gitlab], expected: 'gitlab' },
    { path: 'group/dns', sources: [cmu, gitlab], expected: 'gitlab' },
    { path: 'group/dns', sources: [cmu], expected: null },
    { path: null, sources: [cmu], expected: null },
  ])('maps $path to $expected', ({ path, sources, expected }) => {
    expect(moduleSourceOf({ path }, sources)?.name ?? null).toBe(expected);
  });
});

describe('isLeftover', () => {
  /**
   * Verifies: a Module is a leftover when the API reports missingSince, or inSource false; not when it reports neither, or reports it still there.
   * Interacts with: nothing; a pure function.
   * Data: the shapes in the row.
   */
  it.each([
    { extra: { missingSince: '2026-11-01T00:00:00Z' }, expected: true },
    { extra: { inSource: false }, expected: true },
    { extra: { missingSince: null, inSource: true }, expected: false },
    { extra: {}, expected: false },
  ])('is $expected for $extra', ({ extra, expected }) => {
    expect(isLeftover({ id: 'm', ...extra })).toBe(expected);
  });
});

describe('groupModules', () => {
  /**
   * Verifies: every Module lands under the longest source its Path starts with, sorted by name; a configured source with no Modules still has an empty group.
   * Interacts with: nothing; a pure function.
   * Data: sources cmu, cmu/extra, sei and an empty uni.
   */
  it('groups Modules by the longest source name and keeps empty sources', () => {
    const uni: ModuleSource = { name: 'uni', provider: 'git' };
    const groups = groupModules([vm, deep, exercise], [cmu, extra, sei, uni]);

    expect(groups.bySource.get('cmu').map((m) => m.name)).toEqual([
      'exercise-x',
    ]);
    expect(groups.bySource.get('cmu/extra').map((m) => m.name)).toEqual([
      'deep',
    ]);
    expect(groups.bySource.get('sei').map((m) => m.name)).toEqual([
      'machine-blank',
    ]);
    expect(groups.bySource.get('uni')).toEqual([]);
    expect(groups.leftovers).toEqual([]);
  });

  /**
   * Verifies: a Module marked missing, and one whose source is not configured, go to the leftovers, not to a source; GitLab Modules stay with the GitLab source.
   * Interacts with: nothing; a pure function.
   * Data: old (missingSince), orphan (uni, not configured), dns (GitLab's).
   */
  it('puts leftovers and Modules of no configured source last', () => {
    const groups = groupModules([old, orphan, dns, exercise], [cmu, gitlab]);

    expect(groups.leftovers.map((m) => m.name)).toEqual(['old']);
    expect(groups.bySource.get('gitlab').map((m) => m.name)).toEqual([
      'dns',
      'orphan',
    ]);

    const noGitlab = groupModules([orphan, old], [cmu]);
    expect(noGitlab.leftovers.map((m) => m.name)).toEqual(['old', 'orphan']);
  });

  /**
   * Verifies: a row carries its source's name and its highest version as the API names it, empty when the API has none.
   * Interacts with: nothing; a pure function.
   * Data: machine-blank whose latest version the API names v1.10.0, and a Module with none.
   */
  it('adds the source and latest version to a row', () => {
    expect(toModuleRow(vm, [sei])).toMatchObject({
      source: 'sei',
      latestVersion: 'v1.10.0',
      leftover: false,
    });
    expect(
      toModuleRow({ id: '9', path: 'sei/x', latestVersion: null }, [sei])
        .latestVersion,
    ).toBe('');
  });
});

describe('moduleMatches', () => {
  const row = toModuleRow(vm, [sei]);

  /**
   * Verifies: a Module matches on its name, path, description or latest version, in any case, and not on anything else.
   * Interacts with: nothing; a pure function.
   * Data: machine-blank.
   */
  it.each([
    { term: 'machine', expected: true },
    { term: 'sei/', expected: true },
    { term: 'blank vm', expected: true },
    { term: 'v1.10', expected: true },
    { term: 'v1.9', expected: false },
    { term: 'gitlab', expected: false },
  ])('is $expected for "$term"', ({ term, expected }) => {
    expect(moduleMatches(row, term)).toBe(expected);
  });
});

describe('viewGroups', () => {
  const sources = [sei, cmu, gitlab];
  const groups = groupModules([vm, exercise, old, dns], sources);

  /**
   * Verifies: with no search every source is shown, sorted by name, with all its Modules and none forced open; the leftover group is shown when it has Modules.
   * Interacts with: nothing; a pure function.
   * Data: sources sei, cmu, gitlab given out of order.
   */
  it('lists every source by name when nothing is searched', () => {
    const view = viewGroups(sources, groups, '  ');

    expect(view.sources.map((s) => s.source.name)).toEqual([
      'cmu',
      'gitlab',
      'sei',
    ]);
    expect(view.sources.every((s) => !s.forceOpen)).toBe(true);
    expect(view.sources[0].total).toBe(1);
    expect(view.leftovers.modules.map((m) => m.name)).toEqual(['old']);
    expect(view.leftovers.forceOpen).toBe(false);
  });

  /**
   * Verifies: a search shows only the sources with matching Modules, opened and listing just those; the others are hidden, and the total still counts all of the source's Modules.
   * Interacts with: nothing; a pure function.
   * Data: "machine" matches sei only.
   */
  it('keeps and opens only sources with matches', () => {
    const view = viewGroups(sources, groups, 'Machine');

    expect(view.sources).toHaveLength(1);
    expect(view.sources[0]).toMatchObject({ forceOpen: true, total: 1 });
    expect(view.sources[0].source.name).toBe('sei');
    expect(view.leftovers).toBeNull();
  });

  /**
   * Verifies: a source whose own name matches is shown with all its Modules but is not forced open, unless one of its Modules matches too.
   * Interacts with: nothing; a pure function.
   * Data: "cmu" matches the source cmu and the path of exercise-x and of old.
   */
  it('shows a source that matches by name without opening it', () => {
    const named = viewGroups(
      [cmu, sei],
      groupModules([vm, exercise], [cmu, sei]),
      'sei',
    );
    // sei matches by name and by the path of machine-blank.
    expect(named.sources.map((s) => [s.source.name, s.forceOpen])).toEqual([
      ['sei', true],
    ]);

    const empty = viewGroups(
      [cmu, sei],
      groupModules([exercise], [cmu, sei]),
      'sei',
    );
    expect(
      empty.sources.map((s) => [s.source.name, s.forceOpen, s.total]),
    ).toEqual([['sei', false, 0]]);
  });

  /**
   * Verifies: the leftover group is shown and opened when one of its Modules matches, listing only those, and the Delete-able leftovers of other searches are hidden.
   * Interacts with: nothing; a pure function.
   * Data: "old" matches the leftover only.
   */
  it('shows the leftover group when a leftover matches', () => {
    const view = viewGroups(sources, groups, 'old');

    expect(view.sources).toEqual([]);
    expect(view.leftovers).toMatchObject({ forceOpen: true, total: 1 });
  });

  /**
   * Verifies: nothing matching leaves no sources and no leftover group.
   * Interacts with: nothing; a pure function.
   * Data: a term in no field.
   */
  it('returns nothing when nothing matches', () => {
    const view = viewGroups(sources, groups, 'zzz');

    expect(view.sources).toEqual([]);
    expect(view.leftovers).toBeNull();
  });
});

describe('sortModules', () => {
  const rows = ['b', 'a', 'c'].map((name, i) => ({
    id: `${i}`,
    name,
    latestVersion: ['v1.10.0', 'v1.9.0', ''][i],
  })) as ModuleRow[];

  /**
   * Verifies: a column sorts ascending or descending, version names by number, and no direction keeps the order given.
   * Interacts with: nothing; a pure function.
   * Data: names b, a, c; versions v1.10.0, v1.9.0 and none.
   */
  it('sorts by a column and leaves the order with no direction', () => {
    expect(sortModules(rows, 'name', 'asc').map((r) => r.name)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(sortModules(rows, 'name', 'desc').map((r) => r.name)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(
      sortModules(rows, 'latestVersion', 'asc').map((r) => r.name),
    ).toEqual(['c', 'a', 'b']);
    expect(sortModules(rows, 'name', '').map((r) => r.name)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });
});

describe('sourceAccessRows', () => {
  /**
   * Verifies: each source gets the access summary the scopes work out, with who by name in its tooltip.
   * Interacts with: sourceAccess and accessSummary (real).
   * Data: a scope allowing cmu, assigned to Range A.
   */
  it('says who may use each source', () => {
    const scope: ModuleScope = {
      id: 's1',
      name: 'CMU access',
      paths: ['cmu'],
      projects: [{ projectId: 'p1', name: 'Range A' }],
      projectGroups: [],
    };
    const rows = sourceAccessRows([cmu, sei], [scope]);

    expect(rows.get('cmu').tooltip).toContain('Projects: Range A.');
    expect(rows.get('cmu').summary.text).not.toBe(rows.get('sei').summary.text);
    expect(rows.get('cmu').folderNote).toBeNull();
  });

  /**
   * Verifies: a legacy scope for a folder of a source gives the source's row a muted note and the scope's name for its tooltip, leaves the summary and the project tooltip without it, and touches no other source.
   * Interacts with: sourceAccess and folderScopesNote (real).
   * Data: a scope for cmu/exercise-x assigned to Range A.
   */
  it('notes a legacy folder scope on its source, not as access', () => {
    const scope: ModuleScope = {
      id: 's2',
      name: 'Old folder',
      paths: ['cmu/exercise-x'],
      projects: [{ projectId: 'p1', name: 'Range A' }],
      projectGroups: [],
    };
    const rows = sourceAccessRows([cmu, sei], [scope]);

    expect(rows.get('cmu').summary.text).toBe('Only projects with no scope');
    expect(rows.get('cmu').tooltip).not.toContain('Range A');
    expect(rows.get('cmu').folderNote).toBe(
      '1 scope limits access to folders of this source.',
    );
    expect(rows.get('cmu').folderTooltip).toBe('Old folder');
    expect(rows.get('sei').folderNote).toBeNull();
  });
});

describe('shared sources', () => {
  /**
   * Verifies: a shared source is open to every project whatever the scopes say, with the shared tooltip and no folder note.
   * Interacts with: sourceAccessRows (real).
   * Data: cmu shared, a scope for cmu/x assigned to nobody else, sei not shared.
   */
  it('is open to every project and says why', () => {
    const scope: ModuleScope = {
      id: 's3',
      name: 'Old',
      paths: ['cmu/x', 'sei'],
      projects: [{ projectId: 'p1', name: 'Range A' }],
      projectGroups: [],
    };
    const rows = sourceAccessRows([{ ...cmu, shared: true }, sei], [scope]);

    expect(rows.get('cmu')).toEqual({
      summary: { kind: 'open', text: 'Open to every project', note: null },
      tooltip: 'Shared source: every project can use it',
      shared: true,
      folderNote: null,
      folderTooltip: '',
    });
    expect(rows.get('sei').shared).toBe(false);
    expect(rows.get('sei').summary.text).toBe('Allowed for 1 project');
  });
});

describe('sourceStatus', () => {
  /**
   * Verifies: a source's last read gives a short word with no time, the helpful detail (error, API message) without a time, and a tooltip meaning; a failed source that still shows older Modules keeps that time in the tooltip only.
   * Interacts with: nothing; a pure function.
   * Data: TZ unset for the time, so only its shape is checked.
   */
  it.each([
    {
      source: { ...cmu, lastSuccess: '2026-10-14T12:30:00Z' },
      kind: 'ok',
      word: 'Updated',
      detail: null,
      reason: /^Read successfully$/,
    },
    {
      source: { ...cmu, lastSuccess: '2026-10-14T12:30:00Z', error: 'down.' },
      kind: 'failed',
      word: 'Last sync failed',
      detail: 'down.',
      reason: /^Couldn't be read\. Showing its Modules from .*2026.*\.$/,
    },
    {
      source: { ...cmu, error: 'down.' },
      kind: 'failed',
      word: 'Last sync failed',
      detail: 'down.',
      reason: /^Couldn't be read$/,
    },
    {
      source: cmu,
      kind: 'pending',
      word: 'Not read yet',
      detail: null,
      reason: /^Not read yet$/,
    },
    {
      source: { ...cmu, state: 'Empty', message: 'None.' },
      kind: 'empty',
      word: 'Empty',
      detail: 'None.',
      reason: /^No Modules yet$/,
    },
    {
      source: { ...cmu, state: 'Warning' },
      kind: 'warning',
      word: 'Warning',
      detail: 'Needs attention.',
      reason: /^Needs attention$/,
    },
  ])('reads $kind', ({ source, kind, word, detail, reason }) => {
    const status = sourceStatus(source);

    expect(status.kind).toBe(kind);
    expect(status.word).toBe(word);
    expect(status.detail).toBe(detail);
    expect(status.reason).toMatch(reason);
    expect(status.word + (status.detail ?? '')).not.toMatch(/20\d\d/);
  });
});

describe('the table rows', () => {
  const sources = [sei, cmu, gitlab];
  const groups = groupModules([vm, exercise, old, dns], sources);
  const access = new Map([
    [
      'cmu',
      {
        summary: { kind: 'allowed', text: 'Allowed', note: null },
        tooltip: 't',
        folderNote: null,
        folderTooltip: '',
      },
    ],
  ]) as unknown as ReturnType<typeof sourceAccessRows>;

  /**
   * Verifies: the rows are the sources by name, each with its status, its access when known and a detail id of its own, then the leftover group last with no source, status or access.
   * Interacts with: viewGroups, sourceStatus (real).
   * Data: sources out of order; old is a leftover.
   */
  it('lists the sources, then the leftover group', () => {
    const rows = sourceTableRows(viewGroups(sources, groups, ''), access);

    expect(rows.map((r) => r.name)).toEqual([
      'cmu',
      'gitlab',
      'sei',
      LEFTOVER_TITLE,
    ]);
    expect(rows[0].access.summary.text).toBe('Allowed');
    expect(rows[1].access).toBeNull();
    expect(rows[0].status.kind).toBe('pending');
    expect(new Set(rows.map((r) => r.detailId)).size).toBe(4);
    expect(rows[3]).toMatchObject({
      key: LEFTOVER_KEY,
      source: null,
      status: null,
      access: null,
    });
  });

  /**
   * Verifies: a table with no leftovers has no leftover row.
   * Interacts with: viewGroups.
   * Data: no leftover Modules.
   */
  it('has no leftover row when there are no leftovers', () => {
    const rows = sourceTableRows(
      viewGroups(sources, groupModules([vm], sources), ''),
      null,
    );

    expect(rows.map((r) => r.name)).toEqual(['cmu', 'gitlab', 'sei']);
    expect(rows[0].access).toBeNull();
  });

  /**
   * Verifies: the rows sort by name, Modules count, status and last update in either direction, and the leftover group stays last for every column and direction.
   * Interacts with: sourceTableRows, viewGroups.
   * Data: sei has 1 Module, cmu 1 (and a leftover), gitlab none, with different last reads.
   */
  it.each([
    { active: 'name', direction: 'desc', order: ['sei', 'gitlab', 'cmu'] },
    { active: 'modules', direction: 'asc', order: ['gitlab', 'cmu', 'sei'] },
    { active: 'modules', direction: 'desc', order: ['cmu', 'sei', 'gitlab'] },
    {
      active: 'lastSuccess',
      direction: 'desc',
      order: ['sei', 'cmu', 'gitlab'],
    },
    { active: 'status', direction: 'asc', order: ['sei', 'gitlab', 'cmu'] },
    { active: 'name', direction: '', order: ['cmu', 'gitlab', 'sei'] },
  ])(
    'sorts by $active $direction with the leftovers last',
    ({ active, direction, order }) => {
      const read: ModuleSource[] = [
        { ...cmu, lastSuccess: '2026-10-02T00:00:00Z' },
        { ...sei, lastSuccess: '2026-10-03T00:00:00Z', error: 'down.' },
        gitlab,
      ];
      const rows = sourceTableRows(
        viewGroups(read, groupModules([vm, exercise, old], read), ''),
        null,
      );

      const sorted = sortSourceRows(
        rows,
        active,
        direction as 'asc' | 'desc' | '',
      );

      expect(sorted.map((r) => r.name)).toEqual([...order, LEFTOVER_TITLE]);
    },
  );
});
