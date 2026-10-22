// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import {
  Resource,
  Run,
  RunStatus,
  Workspace,
} from '../../generated/caster-api';
import { recordEmissions } from '../../test-utils/record-emissions';
import { ResourceActions, StatusFilter } from './workspace.model';
import { WorkspaceQuery } from './workspace.query';
import { WorkspaceStore } from './workspace.store';

// Real store + real query, no TestBed: the query only reads the store, so
// seeding the store and asserting on the selectors exercises the real code.

function ws(overrides: Partial<Workspace> = {}): Workspace {
  return { id: 'w1', name: 'Alpha', directoryId: 'd1', runs: [], ...overrides };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    workspaceId: 'w1',
    status: RunStatus.Planned,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function setup(workspaces: Workspace[] = []) {
  const store = new WorkspaceStore();
  const query = new WorkspaceQuery(store);
  store.add(workspaces);
  return { store, query };
}

const ids = (runs: Run[] | undefined) => runs?.map((r) => r.id);

describe('WorkspaceQuery', () => {
  describe('selectAll', () => {
    /**
     * Verifies: workspaces come out in case-insensitive name order, whatever
     *   the insertion order (@QueryConfig sortBy 'name' ASC).
     * Interacts with: QueryEntity.selectAll + @QueryConfig.
     * Data: workspaces named 'charlie', 'Alpha', 'bravo', added in that order.
     */
    it('sorts workspaces by name, ignoring case', async () => {
      const { query } = setup([
        ws({ id: 'c', name: 'charlie' }),
        ws({ id: 'a', name: 'Alpha' }),
        ws({ id: 'b', name: 'bravo' }),
      ]);

      const all = await firstValueFrom(query.selectAll());

      expect(all.map((w) => w.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('workspaceRuns$', () => {
    /**
     * Verifies: runs are returned newest first by createdAt, as a copy, so the
     *   stored (frozen) runs array keeps its original order.
     * Interacts with: selectEntity(runs) + filters$ via combineLatest.
     * Data: three runs with shuffled createdAt; default (empty) status filters.
     */
    it('sorts runs newest first without reordering the store', async () => {
      const { query } = setup([
        ws({
          runs: [
            run({ id: 'mid', createdAt: '2026-01-02T00:00:00Z' }),
            run({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
            run({ id: 'new', createdAt: '2026-01-03T00:00:00Z' }),
          ],
        }),
      ]);

      const runs = await firstValueFrom(query.workspaceRuns$('w1'));

      expect(ids(runs)).toEqual(['new', 'mid', 'old']);
      expect(ids(query.getEntity('w1').runs)).toEqual(['mid', 'old', 'new']);
    });

    /**
     * Verifies: a filter entry with filter === true hides runs whose status
     *   equals its key; entries with filter === false hide nothing.
     * Interacts with: ui statusFilter -> filters$ -> workspaceRuns$.
     * Data: Failed, Applied and Planned runs; filters Failed:true, Applied:false.
     */
    it('hides runs whose status has an active filter', async () => {
      const { store, query } = setup([
        ws({
          runs: [
            run({ id: 'failed', status: RunStatus.Failed }),
            run({ id: 'applied', status: RunStatus.Applied }),
            run({ id: 'planned', status: RunStatus.Planned }),
          ],
        }),
      ]);
      const filters: StatusFilter[] = [
        { key: 'Failed', filter: true },
        { key: 'Applied', filter: false },
      ];
      store.ui.update('w1', { statusFilter: filters });

      const runs = await firstValueFrom(query.workspaceRuns$('w1'));

      expect(ids(runs)?.sort()).toEqual(['applied', 'planned']);
    });

    /**
     * Verifies: when no filter entry is active, every run is returned.
     * Interacts with: ui statusFilter -> workspaceRuns$.
     * Data: two runs; every filter entry set to false.
     */
    it('returns every run when no filter is active', async () => {
      const { store, query } = setup([
        ws({
          runs: [
            run({ id: 'failed', status: RunStatus.Failed }),
            run({ id: 'planned', status: RunStatus.Planned }),
          ],
        }),
      ]);
      store.ui.update('w1', {
        statusFilter: [
          { key: 'Failed', filter: false },
          { key: 'Planned', filter: false },
        ],
      });

      const runs = await firstValueFrom(query.workspaceRuns$('w1'));

      expect(runs).toHaveLength(2);
    });

    /**
     * Verifies: filters match on the RunStatus *value*, so the default filter
     *   keys built by WorkspaceService.setStatusFilters (Object.keys(RunStatus))
     *   can't hide the two statuses whose key differs from their value.
     * Interacts with: ui statusFilter -> workspaceRuns$.
     * Data: an 'Applied - State Error' run; filter key 'AppliedStateError' true.
     */
    it('does not hide state-error runs filtered by their RunStatus key', async () => {
      const { store, query } = setup([
        ws({ runs: [run({ id: 'r1', status: RunStatus.AppliedStateError })] }),
      ]);
      store.ui.update('w1', {
        statusFilter: [{ key: 'AppliedStateError', filter: true }],
      });

      const runs = await firstValueFrom(query.workspaceRuns$('w1'));

      expect(ids(runs)).toEqual(['r1']);
    });

    /**
     * Verifies: an empty runs array, or an unknown workspace id, emits
     *   undefined rather than [].
     * Interacts with: workspaceRuns$ map (no branch for empty runs).
     * Data: w1 with runs: []; id 'missing'.
     */
    it('emits undefined, not [], when there are no runs', async () => {
      const { query } = setup([ws()]);

      // NOTE: callers must treat undefined as "no runs".
      expect(await firstValueFrom(query.workspaceRuns$('w1'))).toBeUndefined();
      expect(
        await firstValueFrom(query.workspaceRuns$('missing')),
      ).toBeUndefined();
    });

    /**
     * Verifies: the stream re-emits when either the runs or the filters change.
     * Interacts with: combineLatest over selectEntity and ui.selectEntity.
     * Data: one Failed run; then a second run is added; then Failed is filtered.
     */
    it('re-emits when runs or filters change', () => {
      const { store, query } = setup([
        ws({ runs: [run({ id: 'r1', status: RunStatus.Failed })] }),
      ]);
      const seen = recordEmissions(query.workspaceRuns$('w1'));

      store.update('w1', (w) => ({
        runs: [
          ...w.runs,
          run({
            id: 'r2',
            status: RunStatus.Planned,
            createdAt: '2026-02-01T00:00:00Z',
          }),
        ],
      }));
      store.ui.update('w1', {
        statusFilter: [{ key: 'Failed', filter: true }],
      });

      expect(seen.map(ids)).toEqual([['r1'], ['r2', 'r1'], ['r2']]);
    });
  });

  describe('workspaceResources$', () => {
    /**
     * Verifies: emits the workspace's resources, and undefined for a workspace
     *   that has none or is unknown.
     * Interacts with: selectEntity(resources).
     * Data: w1 with one resource; w2 with no resources field.
     */
    it('selects the resources of one workspace', async () => {
      const resource: Resource = { id: 'res-1', address: 'aws_instance.a' };
      const { query } = setup([
        ws({ resources: [resource] }),
        ws({ id: 'w2', name: 'Beta' }),
      ]);

      expect(await firstValueFrom(query.workspaceResources$('w1'))).toEqual([
        resource,
      ]);
      expect(
        await firstValueFrom(query.workspaceResources$('w2')),
      ).toBeUndefined();
      expect(
        await firstValueFrom(query.workspaceResources$('missing')),
      ).toBeUndefined();
    });
  });

  describe('UI selectors', () => {
    /**
     * Verifies: each UI selector emits the initial UI state for a newly added
     *   workspace.
     * Interacts with: ui.selectEntity in selectedRuns$, expandedRuns$,
     *   resourceActions$, resourceAction$, expandedResources$, filters$,
     *   getWorkspaceView.
     * Data: one freshly added workspace.
     */
    it('emit the defaults for a new workspace', async () => {
      const { query } = setup([ws()]);

      expect(await firstValueFrom(query.selectedRuns$('w1'))).toEqual([]);
      expect(await firstValueFrom(query.expandedRuns$('w1'))).toEqual([]);
      expect(await firstValueFrom(query.resourceActions$('w1'))).toEqual([]);
      expect(await firstValueFrom(query.resourceAction$('w1'))).toBe(
        ResourceActions.None,
      );
      expect(await firstValueFrom(query.expandedResources$('w1'))).toEqual([]);
      expect(await firstValueFrom(query.filters$('w1'))).toEqual([]);
      expect(await firstValueFrom(query.getWorkspaceView('w1'))).toBe('runs');
    });

    /**
     * Verifies: each UI selector reads its own field of the workspace's UI
     *   entity, and only that workspace's entity.
     * Interacts with: ui.selectEntity projections.
     * Data: w1 UI updated with distinct values for every field; w2 untouched.
     */
    it('read their own field of the matching UI entity', async () => {
      const { store, query } = setup([ws(), ws({ id: 'w2', name: 'Beta' })]);
      const filters: StatusFilter[] = [{ key: 'Failed', filter: true }];
      store.ui.update('w1', {
        selectedRuns: ['r1'],
        expandedRuns: ['r2'],
        resourceActions: ['aws_instance.a'],
        resourceAction: ResourceActions.Remove,
        expandedResources: ['aws_instance.b'],
        statusFilter: filters,
        workspaceView: 'resources',
      });

      expect(await firstValueFrom(query.selectedRuns$('w1'))).toEqual(['r1']);
      expect(await firstValueFrom(query.expandedRuns$('w1'))).toEqual(['r2']);
      expect(await firstValueFrom(query.resourceActions$('w1'))).toEqual([
        'aws_instance.a',
      ]);
      expect(await firstValueFrom(query.resourceAction$('w1'))).toBe(
        ResourceActions.Remove,
      );
      expect(await firstValueFrom(query.expandedResources$('w1'))).toEqual([
        'aws_instance.b',
      ]);
      expect(await firstValueFrom(query.filters$('w1'))).toEqual(filters);
      expect(await firstValueFrom(query.getWorkspaceView('w1'))).toBe(
        'resources',
      );
      expect(await firstValueFrom(query.selectedRuns$('w2'))).toEqual([]);
    });

    /**
     * Verifies: expandedRuns$() without an id flattens the expanded run ids of
     *   every workspace into one array, and re-emits on change.
     * Interacts with: ui.selectAll in expandedRuns$.
     * Data: w1 expands r1; w2 expands r2 and r3; later w1 collapses.
     */
    it('flattens expanded runs across workspaces when no id is given', () => {
      const { store, query } = setup([ws(), ws({ id: 'w2', name: 'Beta' })]);
      store.ui.update('w1', { expandedRuns: ['r1'] });
      store.ui.update('w2', { expandedRuns: ['r2', 'r3'] });
      const seen = recordEmissions(query.expandedRuns$());

      store.ui.update('w1', { expandedRuns: [] });

      expect(seen).toEqual([
        ['r1', 'r2', 'r3'],
        ['r2', 'r3'],
      ]);
    });
  });

  describe('selectRunById$', () => {
    /**
     * Verifies: finds a run by id inside a workspace, and emits undefined for
     *   an unknown run id.
     * Interacts with: selectEntity(workspace, 'runs').
     * Data: w1 with runs r1 and r2.
     */
    it('finds a run in the workspace', async () => {
      const { query } = setup([
        ws({ runs: [run({ id: 'r1' }), run({ id: 'r2' })] }),
      ]);

      expect((await firstValueFrom(query.selectRunById$('w1', 'r2')))?.id).toBe(
        'r2',
      );
      expect(
        await firstValueFrom(query.selectRunById$('w1', 'nope')),
      ).toBeUndefined();
    });

    /**
     * Verifies: an unknown workspace id makes the stream error with a
     *   TypeError (current behavior).
     * Interacts with: selectEntity(missing, 'runs') -> runs.find.
     * Data: an empty store.
     */
    it('errors for an unknown workspace', async () => {
      const { query } = setup();

      await expect(
        firstValueFrom(query.selectRunById$('missing', 'r1')),
      ).rejects.toThrow(TypeError);
    });
  });

  describe('selectResourceById$', () => {
    /**
     * Verifies: matches a resource on its `id` field and replays the last value
     *   to late subscribers.
     * Interacts with: Akita arrayFind (default idKey 'id') + shareReplay(1).
     * Data: two resources with ids res-1/res-2 and distinct addresses.
     */
    it('finds a resource by id and replays it', async () => {
      const a: Resource = { id: 'res-1', address: 'aws_instance.a' };
      const b: Resource = { id: 'res-2', address: 'aws_instance.b' };
      const { query } = setup([ws({ resources: [a, b] })]);

      const byId$ = query.selectResourceById$('w1', 'res-2');

      expect(await firstValueFrom(byId$)).toEqual(b);
      // NOTE: WorkspaceService keys resources by `address` (loadResource), but
      // this selector matches on `id`. No caller uses it today.
      expect(
        await firstValueFrom(query.selectResourceById$('w1', 'aws_instance.b')),
      ).toBeUndefined();
      expect(await firstValueFrom(byId$)).toEqual(b);
    });
  });

  describe('activeRuns$', () => {
    /**
     * Verifies: collects Queued, Planning, Applying and ApplyQueued runs from
     *   every workspace (workspace name order), skipping other statuses and
     *   workspaces without a runs array.
     * Interacts with: selectAll (sorted by name) + status filter.
     * Data: Beta has Queued + Applied runs; Alpha has Planning, Applying,
     *   ApplyQueued, Failed; Gamma has no runs field.
     */
    it('lists active runs across workspaces', async () => {
      const { store, query } = setup([
        ws({
          id: 'w2',
          name: 'Beta',
          runs: [
            run({
              id: 'b-queued',
              workspaceId: 'w2',
              status: RunStatus.Queued,
            }),
            run({
              id: 'b-applied',
              workspaceId: 'w2',
              status: RunStatus.Applied,
            }),
          ],
        }),
        ws({
          id: 'w1',
          name: 'Alpha',
          runs: [
            run({ id: 'a-planning', status: RunStatus.Planning }),
            run({ id: 'a-applying', status: RunStatus.Applying }),
            run({ id: 'a-applyqueued', status: RunStatus.ApplyQueued }),
            run({ id: 'a-failed', status: RunStatus.Failed }),
          ],
        }),
      ]);
      store.upsert('w3', { name: 'Gamma' });

      const active = await firstValueFrom(query.activeRuns$());

      expect(ids(active)).toEqual([
        'a-planning',
        'a-applying',
        'a-applyqueued',
        'b-queued',
      ]);
    });

    /**
     * Verifies: a run drops out of activeRuns$ once its status leaves the
     *   active set.
     * Interacts with: activeRuns$ re-emitting on store update.
     * Data: one Planning run that becomes Planned.
     */
    it('drops a run once it is no longer active', () => {
      const { store, query } = setup([
        ws({ runs: [run({ id: 'r1', status: RunStatus.Planning })] }),
      ]);
      const seen = recordEmissions(query.activeRuns$());

      store.update('w1', {
        runs: [run({ id: 'r1', status: RunStatus.Planned })],
      });

      expect(seen.map(ids)).toEqual([['r1'], []]);
    });
  });

  describe('getOrSelectEntity', () => {
    /**
     * Verifies: a workspace already in the store is returned as a one-shot
     *   of(entity) that completes and does not follow later changes.
     * Interacts with: getEntity -> of().
     * Data: w1 present, then renamed after subscribing.
     */
    it('returns a completed snapshot for a known workspace', () => {
      const { store, query } = setup([ws()]);
      const seen = recordEmissions(query.getOrSelectEntity('w1'));

      store.update('w1', { name: 'Renamed' });

      expect(seen.map((w) => w.name)).toEqual(['Alpha']);
    });

    /**
     * Verifies: an unknown workspace returns a live selectEntity stream that
     *   emits undefined first, then the workspace once it is added.
     * Interacts with: selectEntity.
     * Data: empty store; w1 added after subscribing.
     */
    it('follows the store for a workspace that is not loaded yet', () => {
      const { store, query } = setup();
      const seen = recordEmissions(query.getOrSelectEntity('w1'));

      store.add(ws());

      expect(seen).toEqual([undefined, ws()]);
    });
  });
});
