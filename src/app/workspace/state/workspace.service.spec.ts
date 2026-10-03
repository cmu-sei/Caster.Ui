// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  firstValueFrom,
  NEVER,
  Observable,
  of,
  Subject,
  throwError,
} from 'rxjs';
import {
  AppliesService,
  Apply,
  CreateRunCommand,
  FilesService,
  ImportResourceCommand,
  ModelFile,
  PartialEditWorkspaceCommand,
  QueuePosition,
  Resource,
  ResourceCommandResult,
  ResourcesService,
  Run,
  RunsService,
  RunStatus,
  Workspace,
  WorkspacesService,
} from '../../generated/caster-api';
import { FileQuery } from '../../files/state';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { recordEmissions } from '../../test-utils/record-emissions';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../test-utils/unhandled-rx-errors';
import { ResourceActions, StatusFilter } from './workspace.model';
import { WorkspaceQuery } from './workspace.query';
import { WorkspaceService } from './workspace.service';
import {
  initialWorkspaceEntityUiState,
  WorkspaceStore,
} from './workspace.store';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A workspace as the store holds it once its runs are loaded. */
function ws(overrides: Partial<Workspace> = {}): Workspace {
  return { id: 'w1', name: 'Alpha', directoryId: 'd1', runs: [], ...overrides };
}

/**
 * A workspace as the API sends it. The API view model has no `runs`, but the
 * app's declaration merge (workspace.model.ts) marks `runs` required, so cast
 * once here.
 */
function apiWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'w1',
    name: 'Alpha',
    directoryId: 'd1',
    ...overrides,
  } as Workspace;
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

const resA: Resource = { id: 'i-a', name: 'a', address: 'aws_instance.a' };
const resB: Resource = { id: 'i-b', name: 'b', address: 'aws_instance.b' };

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Apis {
  workspaces?: ApiStub<WorkspacesService>;
  runs?: ApiStub<RunsService>;
  applies?: ApiStub<AppliesService>;
  resources?: ApiStub<ResourcesService>;
  files?: ApiStub<FilesService>;
}

/**
 * Real WorkspaceStore, WorkspaceQuery, WorkspaceService and FileService. Only
 * the generated API services are stubbed; any API not passed here stays an
 * `unstubbed()` placeholder that throws a named error if it is touched.
 * PlansService is injected by WorkspaceService but never called, so it stays a
 * placeholder.
 */
function setup(apis: Apis = {}, workspaces: Workspace[] = []) {
  const overrides: Provider[] = [];
  if (apis.workspaces)
    overrides.push({ provide: WorkspacesService, useValue: apis.workspaces });
  if (apis.runs) overrides.push({ provide: RunsService, useValue: apis.runs });
  if (apis.applies)
    overrides.push({ provide: AppliesService, useValue: apis.applies });
  if (apis.resources)
    overrides.push({ provide: ResourcesService, useValue: apis.resources });
  if (apis.files)
    overrides.push({ provide: FilesService, useValue: apis.files });

  TestBed.configureTestingModule({ providers: getDefaultProviders(overrides) });

  const store = TestBed.inject(WorkspaceStore);
  const query = TestBed.inject(WorkspaceQuery);
  const service = TestBed.inject(WorkspaceService);
  // add() of a non-empty list also clears the store's initial loading flag.
  store.add(workspaces);
  return { service, store, query };
}

const boom = () => throwError(() => new Error('boom'));

// ---------------------------------------------------------------------------

describe('WorkspaceService', () => {
  describe('getWorkspace', () => {
    /**
     * Verifies: a workspace that is not loaded yet is fetched and added with
     *   an empty runs array and the default UI state.
     * Interacts with: WorkspacesService.getWorkspace (stub); WorkspaceStore.add.
     * Data: empty store; the API returns w1 without runs.
     */
    it('adds a fetched workspace with an empty runs array', () => {
      const workspacesApi = {
        getWorkspace: vi.fn(() => of(apiWorkspace())),
      } satisfies ApiStub<WorkspacesService>;
      const { service, query } = setup({ workspaces: workspacesApi });

      service.getWorkspace('w1');

      expect(workspacesApi.getWorkspace).toHaveBeenCalledWith('w1');
      expect(query.getEntity('w1')).toEqual({ ...apiWorkspace(), runs: [] });
      expect(query.ui.getEntity('w1')).toEqual({
        id: 'w1',
        ...initialWorkspaceEntityUiState,
      });
    });

    /**
     * Verifies: for a workspace already in the store, the fetched data is
     *   discarded and the stored copy is kept as-is.
     * Interacts with: WorkspacesService.getWorkspace (stub); WorkspaceQuery.getEntity.
     * Data: stored w1 'Alpha' with one run; the API returns w1 'Renamed'.
     */
    it('keeps the stored copy of a workspace that is already loaded', () => {
      const stored = ws({ runs: [run()] });
      const workspacesApi = {
        getWorkspace: vi.fn(() =>
          of(apiWorkspace({ name: 'Renamed', dynamicHost: true })),
        ),
      } satisfies ApiStub<WorkspacesService>;
      const { service, query } = setup({ workspaces: workspacesApi }, [stored]);

      service.getWorkspace('w1');

      expect(query.getEntity('w1')).toEqual(stored);
    });

    /**
     * Verifies: a failed fetch leaves the store untouched, and the error is
     *   not handled by the service (it reaches rxjs's unhandled-error hook).
     * Interacts with: WorkspacesService.getWorkspace (throwError stub);
     *   rxjs config.onUnhandledError.
     * Data: empty store; the API errors with 'boom'.
     */
    it('leaves the store untouched and does not handle a fetch error', async () => {
      const errors = captureUnhandledRxErrors();
      const { service, query } = setup({
        workspaces: { getWorkspace: vi.fn(boom) },
      });

      service.getWorkspace('w1');
      await flush();

      expect(query.getCount()).toBe(0);
      expect(errors).toEqual([new Error('boom')]);
    });
  });

  describe('setWorkspaces', () => {
    /**
     * Verifies: replaces the stored workspaces with the given list, restores
     *   the UI state of workspaces that are still present, gives new ones the
     *   defaults, and drops the UI of removed ones.
     * Interacts with: WorkspaceStore.set + ui.upsert; WorkspaceQuery.ui.
     * Data: stored w1 (expanded, resources view, with runs) and w3 (expanded);
     *   set to API workspaces w1 'Renamed' and w2.
     */
    it('replaces the workspaces and keeps UI state for the ones that remain', () => {
      const { service, store, query } = setup({}, [
        ws({ runs: [run()] }),
        ws({ id: 'w3', name: 'Gamma' }),
      ]);
      store.ui.update('w1', { isExpanded: true, workspaceView: 'resources' });
      store.ui.update('w3', { isExpanded: true });

      service.setWorkspaces([
        apiWorkspace({ name: 'Renamed' }),
        apiWorkspace({ id: 'w2', name: 'Beta' }),
      ]);

      expect(query.getAll().map((w) => w.id)).toEqual(['w2', 'w1']);
      expect(query.getEntity('w1').name).toBe('Renamed');
      // NOTE: previously loaded runs are dropped, because API workspaces carry
      // no runs. See the runUpdated "no runs array" test for the consequence.
      expect(query.getEntity('w1').runs).toBeUndefined();
      expect(query.ui.getEntity('w1')).toMatchObject({
        isExpanded: true,
        workspaceView: 'resources',
      });
      expect(query.ui.getEntity('w2')).toEqual({
        id: 'w2',
        ...initialWorkspaceEntityUiState,
      });
      expect(query.ui.hasEntity('w3')).toBe(false);
    });
  });

  describe('add', () => {
    /**
     * Verifies: creates the workspace through the API, adds the returned
     *   workspace to the store, then loads its directory's files (without
     *   content) into the file store as saved.
     * Interacts with: WorkspacesService.createWorkspace,
     *   FilesService.getFilesByDirectory (stubs); real FileService/FileQuery.
     * Data: new workspace 'New' in directory d9; API returns w9 and one file.
     */
    it('creates the workspace, stores it and loads its directory files', () => {
      const created = apiWorkspace({
        id: 'w9',
        name: 'New',
        directoryId: 'd9',
      });
      const file: ModelFile = { id: 'f1', name: 'main.tf', directoryId: 'd9' };
      const workspacesApi = {
        createWorkspace: vi.fn(() => of(created)),
      } satisfies ApiStub<WorkspacesService>;
      const filesApi = {
        getFilesByDirectory: vi.fn(() => of([file])),
      } satisfies ApiStub<FilesService>;
      const { service, query } = setup({
        workspaces: workspacesApi,
        files: filesApi,
      });
      const input = ws({ id: undefined, name: 'New', directoryId: 'd9' });

      service.add(input);

      expect(workspacesApi.createWorkspace).toHaveBeenCalledWith(input);
      expect(query.getEntity('w9')).toEqual(created);
      expect(filesApi.getFilesByDirectory).toHaveBeenCalledWith('d9', false);
      const fileQuery = TestBed.inject(FileQuery);
      expect(fileQuery.getEntity('f1')).toMatchObject(file);
      expect(fileQuery.ui.getEntity('f1').isSaved).toBe(true);
    });
  });

  describe('update and partialUpdate', () => {
    /**
     * Verifies: update() sends a copy of the whole workspace to
     *   partialEditWorkspace and merges the response into the stored entity,
     *   keeping fields the API does not return (runs).
     * Interacts with: WorkspacesService.partialEditWorkspace (stub).
     * Data: stored w1 with one run; update with name 'Renamed'.
     */
    it('update() sends the workspace and merges the response', () => {
      const workspacesApi = {
        partialEditWorkspace: vi.fn(
          (_id: string, _command?: PartialEditWorkspaceCommand) =>
            of(apiWorkspace({ name: 'Renamed' })),
        ),
      } satisfies ApiStub<WorkspacesService>;
      const { service, query } = setup({ workspaces: workspacesApi }, [
        ws({ runs: [run()] }),
      ]);
      const edited = ws({ name: 'Renamed', runs: [run()] });

      service.update(edited);

      expect(workspacesApi.partialEditWorkspace).toHaveBeenCalledWith(
        'w1',
        edited,
      );
      expect(workspacesApi.partialEditWorkspace.mock.calls[0][1]).not.toBe(
        edited,
      );
      expect(query.getEntity('w1')).toEqual(
        ws({ name: 'Renamed', runs: [run()] }),
      );
    });

    /**
     * Verifies: partialUpdate() sends only the given fields for the given id
     *   and merges the response.
     * Interacts with: WorkspacesService.partialEditWorkspace (stub).
     * Data: stored w1; partialUpdate('w1', { dynamicHost: true }).
     */
    it('partialUpdate() sends only the changed fields', () => {
      const workspacesApi = {
        partialEditWorkspace: vi.fn(() =>
          of(apiWorkspace({ dynamicHost: true })),
        ),
      } satisfies ApiStub<WorkspacesService>;
      const { service, query } = setup({ workspaces: workspacesApi }, [ws()]);

      service.partialUpdate('w1', { dynamicHost: true });

      expect(workspacesApi.partialEditWorkspace).toHaveBeenCalledWith('w1', {
        dynamicHost: true,
      });
      expect(query.getEntity('w1').dynamicHost).toBe(true);
      expect(query.getEntity('w1').runs).toEqual([]);
    });
  });

  describe('updated, deleted and delete', () => {
    /**
     * Verifies: updated() (the WorkspaceCreated/WorkspaceUpdated hub event)
     *   inserts an unknown workspace with default UI state and merges into a
     *   known one.
     * Interacts with: WorkspaceStore.upsert.
     * Data: stored w1 with a run; events for w1 'Renamed' and new w2.
     */
    it('updated() upserts workspaces from hub events', () => {
      const { service, query } = setup({}, [ws({ runs: [run()] })]);

      service.updated(apiWorkspace({ name: 'Renamed' }));
      service.updated(apiWorkspace({ id: 'w2', name: 'Beta' }));

      expect(query.getEntity('w1')).toEqual(
        ws({ name: 'Renamed', runs: [run()] }),
      );
      expect(query.getEntity('w2')).toEqual(
        apiWorkspace({ id: 'w2', name: 'Beta' }),
      );
      expect(query.ui.getEntity('w2')).toEqual({
        id: 'w2',
        ...initialWorkspaceEntityUiState,
      });
    });

    /**
     * Verifies: deleted() (the WorkspaceDeleted hub event) removes the
     *   workspace and its UI state.
     * Interacts with: WorkspaceStore.remove.
     * Data: stored w1 and w2; deleted('w1').
     */
    it('deleted() removes the workspace and its UI state', () => {
      const { service, query } = setup({}, [
        ws(),
        ws({ id: 'w2', name: 'Beta' }),
      ]);

      service.deleted('w1');

      expect(query.getAll().map((w) => w.id)).toEqual(['w2']);
      expect(query.ui.hasEntity('w1')).toBe(false);
    });

    /**
     * Verifies: delete() asks the API to delete the workspace and removes it
     *   from the store only once the API responds.
     * Interacts with: WorkspacesService.deleteWorkspace (Subject stub).
     * Data: stored w1; the response is held back, then delivered.
     */
    it('delete() removes the workspace after the API succeeds', () => {
      const response$ = new Subject<Workspace>();
      const workspacesApi = {
        deleteWorkspace: vi.fn(() => response$),
      } satisfies ApiStub<WorkspacesService>;
      const { service, query } = setup({ workspaces: workspacesApi }, [ws()]);

      recordEmissions(service.delete(ws()));

      expect(workspacesApi.deleteWorkspace).toHaveBeenCalledWith('w1');
      expect(query.hasEntity('w1')).toBe(true);

      response$.next(apiWorkspace());

      expect(query.hasEntity('w1')).toBe(false);
    });

    /**
     * Verifies: when the API rejects the delete, the workspace stays in the
     *   store and the error reaches the subscriber.
     * Interacts with: WorkspacesService.deleteWorkspace (throwError stub).
     * Data: stored w1; the API errors with 'boom'.
     */
    it('delete() keeps the workspace when the API fails', async () => {
      const { service, query } = setup(
        { workspaces: { deleteWorkspace: vi.fn(boom) } },
        [ws()],
      );

      const error = await firstValueFrom(service.delete(ws())).catch(
        (e: unknown) => e,
      );

      expect(error).toEqual(new Error('boom'));
      expect(query.hasEntity('w1')).toBe(true);
    });
  });

  describe('runUpdated (RunCreated / RunUpdated hub events)', () => {
    /**
     * Verifies: a run for a workspace that is not in the store creates a
     *   skeleton workspace holding the run, with displayStatus copied from
     *   status; a non-queued run does not ask for a queue position.
     * Interacts with: WorkspaceStore.add/update; RunsService.getRunQueuePosition.
     * Data: empty store; a Planning run for w9.
     */
    it('creates a skeleton workspace for a run of an unknown workspace', () => {
      const runsApi = {
        getRunQueuePosition: vi.fn(() => of<QueuePosition>({ position: 1 })),
      } satisfies ApiStub<RunsService>;
      const { service, query } = setup({ runs: runsApi });
      const incoming = run({ workspaceId: 'w9', status: RunStatus.Planning });

      service.runUpdated(incoming);

      expect(query.getEntity('w9')).toEqual({
        id: 'w9',
        runs: [{ ...incoming, displayStatus: RunStatus.Planning }],
      });
      expect(query.ui.hasEntity('w9')).toBe(true);
      expect(runsApi.getRunQueuePosition).not.toHaveBeenCalled();
    });

    /**
     * Verifies: an event for a known run merges into it (keeping fields the
     *   event omits, such as plan) and refreshes displayStatus; an event for a
     *   new run id is appended.
     * Interacts with: Akita arrayUpsert via WorkspaceStore.update.
     * Data: stored w1 with Planning run r1 that has a plan; events r1 Planned
     *   and new r2.
     */
    it('merges known runs and appends new ones', () => {
      const original = run({
        status: RunStatus.Planning,
        plan: { id: 'p1', output: 'planning...' },
        planId: 'p1',
      });
      const { service, query } = setup({}, [ws({ runs: [original] })]);

      service.runUpdated(run({ status: RunStatus.Planned }));
      service.runUpdated(run({ id: 'r2', status: RunStatus.Failed }));

      expect(query.getEntity('w1').runs).toEqual([
        {
          ...original,
          status: RunStatus.Planned,
          displayStatus: RunStatus.Planned,
        },
        run({
          id: 'r2',
          status: RunStatus.Failed,
          displayStatus: RunStatus.Failed,
        }),
      ]);
    });

    /**
     * Verifies: Queued and ApplyQueued runs fetch their queue position and
     *   show it in displayStatus.
     * Interacts with: RunsService.getRunQueuePosition (stub); queuePositionUpdated.
     * Data: stored w1; events r1 Queued (position 1) and r2 ApplyQueued
     *   (position 2).
     */
    it('shows the queue position of queued runs', () => {
      const runsApi = {
        getRunQueuePosition: vi.fn((runId: string) =>
          of<QueuePosition>({
            runId,
            workspaceId: 'w1',
            position: runId === 'r1' ? 1 : 2,
          }),
        ),
      } satisfies ApiStub<RunsService>;
      const { service, query } = setup({ runs: runsApi }, [ws()]);

      service.runUpdated(run({ id: 'r1', status: RunStatus.Queued }));
      service.runUpdated(run({ id: 'r2', status: RunStatus.ApplyQueued }));

      expect(runsApi.getRunQueuePosition.mock.calls).toEqual([['r1'], ['r2']]);
      expect(query.getEntity('w1').runs.map((r) => r.displayStatus)).toEqual([
        'Queued (Position 1)',
        'Queued (Position 2)',
      ]);
    });

    /**
     * Verifies: a null queue position leaves displayStatus as the raw status.
     * Interacts with: RunsService.getRunQueuePosition (stub returning null).
     * Data: stored w1; event r1 Queued.
     */
    it('keeps the raw status when there is no queue position', () => {
      const { service, query } = setup(
        { runs: { getRunQueuePosition: vi.fn(() => of<QueuePosition>(null)) } },
        [ws()],
      );

      service.runUpdated(run({ status: RunStatus.Queued }));

      expect(query.getEntity('w1').runs[0].displayStatus).toBe(
        RunStatus.Queued,
      );
    });

    /**
     * Verifies: a run event for a workspace stored without a runs array (as
     *   API workspaces arrive via setWorkspaces, add or updated) throws.
     * Interacts with: Akita arrayUpsert(undefined, ...).
     * Data: w1 stored from an API payload (no runs); event r1.
     */
    it('throws for a workspace stored without a runs array', () => {
      const { service, store } = setup();
      store.add(apiWorkspace());

      expect(() => service.runUpdated(run())).toThrow(TypeError);
    });
  });

  describe('queuePositionUpdated', () => {
    /**
     * Verifies: the matching run's displayStatus shows its queue position;
     *   other runs are untouched; an unknown workspace is ignored.
     * Interacts with: WorkspaceStore.update.
     * Data: stored w1 with runs r1, r2; position 4 for r2; a position for
     *   workspace 'missing'.
     */
    it('labels only the matching run with its queue position', () => {
      const { service, query } = setup({}, [
        ws({ runs: [run({ id: 'r1' }), run({ id: 'r2' })] }),
      ]);

      service.queuePositionUpdated({
        runId: 'r2',
        workspaceId: 'w1',
        position: 4,
      });
      service.queuePositionUpdated({
        runId: 'r1',
        workspaceId: 'missing',
        position: 1,
      });

      const runs = query.getEntity('w1').runs;
      expect(runs[0]).toEqual(run({ id: 'r1' }));
      expect(runs[1].displayStatus).toBe('Queued (Position 4)');
    });
  });

  describe('planOutputUpdated and applyOutputUpdated', () => {
    /**
     * Verifies: streamed plan/apply output replaces run.plan / run.apply with
     *   `{ output }`, keeping the run's other fields.
     * Interacts with: Akita arrayUpsert via WorkspaceStore.update.
     * Data: stored run r1 with plan p1 and apply a1, both with output.
     */
    it('replaces the plan or apply of a run with the new output', () => {
      const { service, query } = setup({}, [
        ws({
          runs: [
            run({
              plan: { id: 'p1', status: 'Planned', output: 'old plan' },
              apply: { id: 'a1', status: 'Applying', output: 'old apply' },
            }),
          ],
        }),
      ]);

      service.planOutputUpdated('w1', 'r1', 'new plan');
      service.applyOutputUpdated('w1', 'r1', 'new apply');

      const updated = query.getEntity('w1').runs[0];
      // NOTE: plan.id/status and apply.id/status are dropped (the update is a
      // shallow merge on the run). RunComponent only reads `.output`.
      expect(updated.plan).toEqual({ output: 'new plan' });
      expect(updated.apply).toEqual({ output: 'new apply' });
      expect(updated.status).toBe(RunStatus.Planned);
    });

    /**
     * Verifies: output for a run id that is not stored yet appends a run that
     *   holds only its id and the output.
     * Interacts with: Akita arrayUpsert (add branch).
     * Data: stored w1 with no runs; plan output for r9.
     */
    it('appends a placeholder run for output of an unknown run', () => {
      const { service, query } = setup({}, [ws()]);

      service.planOutputUpdated('w1', 'r9', 'plan text');

      expect(query.getEntity('w1').runs).toEqual([
        { id: 'r9', plan: { output: 'plan text' } },
      ]);
    });
  });

  describe('resource commands (taint, untaint, remove)', () => {
    /**
     * Verifies: taint() marks the resources and the Taint action in the UI
     *   immediately (before subscription), sends the addresses, keeps the
     *   action pending until the API responds, then stores the returned
     *   resources and clears the action.
     * Interacts with: ResourcesService.taintResources (Subject stub);
     *   startResourceAction / finishResourceAction.
     * Data: stored w1 with resources a and b; taint both.
     */
    it('taint() tracks the action and stores the returned resources', () => {
      const response$ = new Subject<ResourceCommandResult>();
      const resourcesApi = {
        taintResources: vi.fn(() => response$),
      } satisfies ApiStub<ResourcesService>;
      const { service, query } = setup({ resources: resourcesApi }, [
        ws({ resources: [resA, resB] }),
      ]);

      const taint$ = service.taint('w1', [resA, resB]);

      expect(query.ui.getEntity('w1')).toMatchObject({
        resourceActions: [resA.address, resB.address],
        resourceAction: ResourceActions.Taint,
      });

      const seen = recordEmissions(taint$);
      expect(resourcesApi.taintResources).toHaveBeenCalledWith('w1', {
        resourceAddresses: [resA.address, resB.address],
      });
      expect(query.ui.getEntity('w1').resourceAction).toBe(
        ResourceActions.Taint,
      );

      const result: ResourceCommandResult = {
        resources: [
          { ...resA, tainted: true },
          { ...resB, tainted: true },
        ],
        errors: [],
      };
      response$.next(result);

      expect(seen).toEqual([result]);
      expect(query.getEntity('w1').resources).toEqual(result.resources);
      expect(query.ui.getEntity('w1')).toMatchObject({
        resourceActions: [],
        resourceAction: ResourceActions.None,
      });
    });

    /**
     * Verifies: untaint() accepts a single resource, calls untaintResources,
     *   and records the action as Taint while the request is in flight.
     * Interacts with: ResourcesService.untaintResources (NEVER stub).
     * Data: stored w1 with resource a; untaint a.
     */
    it('untaint() sends one address and shows the Taint action while pending', () => {
      const resourcesApi = {
        // NEVER keeps the request in flight so the pending UI state can be read.
        untaintResources: vi.fn(() => NEVER),
      } satisfies ApiStub<ResourcesService>;
      const { service, query } = setup({ resources: resourcesApi }, [
        ws({ resources: [resA] }),
      ]);

      recordEmissions(service.untaint('w1', resA));

      expect(resourcesApi.untaintResources).toHaveBeenCalledWith('w1', {
        resourceAddresses: [resA.address],
      });
      // ResourceActions has no Untaint value; untaint reuses Taint, and the
      // workspace template tells the two apart by `item.tainted`.
      expect(query.ui.getEntity('w1')).toMatchObject({
        resourceActions: [resA.address],
        resourceAction: ResourceActions.Taint,
      });
    });

    /**
     * Verifies: remove() calls removeResources with the Remove action and
     *   replaces the stored resources with the API's remaining list.
     * Interacts with: ResourcesService.removeResources (stub).
     * Data: stored w1 with resources a and b; remove b; API returns [a].
     */
    it('remove() stores the remaining resources', () => {
      const resourcesApi = {
        removeResources: vi.fn(() =>
          of<ResourceCommandResult>({ resources: [resA] }),
        ),
      } satisfies ApiStub<ResourcesService>;
      const { service, store, query } = setup({ resources: resourcesApi }, [
        ws({ resources: [resA, resB] }),
      ]);
      const actions = recordEmissions(query.resourceAction$('w1'));

      recordEmissions(service.remove('w1', resB));

      expect(resourcesApi.removeResources).toHaveBeenCalledWith('w1', {
        resourceAddresses: [resB.address],
      });
      expect(actions).toEqual([
        ResourceActions.None,
        ResourceActions.Remove,
        ResourceActions.None,
      ]);
      expect(store.getValue().entities['w1'].resources).toEqual([resA]);
    });

    /**
     * Verifies: when a resource command fails, the in-flight UI action is
     *   cleared, the stored resources are kept, and the error still reaches
     *   the subscriber.
     * Interacts with: ResourcesService.taintResources (throwError stub);
     *   processResourceCommand error branch.
     * Data: stored w1 with resource a; the API errors with 'boom'.
     */
    it('clears the action and keeps resources when the command fails', async () => {
      const { service, query } = setup(
        { resources: { taintResources: vi.fn(boom) } },
        [ws({ resources: [resA] })],
      );

      const error = await firstValueFrom(service.taint('w1', resA)).catch(
        (e: unknown) => e,
      );

      expect(error).toEqual(new Error('boom'));
      expect(query.getEntity('w1').resources).toEqual([resA]);
      expect(query.ui.getEntity('w1')).toMatchObject({
        resourceActions: [],
        resourceAction: ResourceActions.None,
      });
    });
  });

  describe('import', () => {
    /**
     * Verifies: import() turns loading on immediately, sends the command on
     *   subscribe, replaces the workspace's resources with the result and
     *   turns loading off.
     * Interacts with: ResourcesService.importResources (stub); store loading.
     * Data: stored w1 with resource a; import returns [a, b].
     */
    it('stores the imported resources and toggles loading', () => {
      const command: ImportResourceCommand = {
        resourceAddress: resB.address,
        resourceId: resB.id,
      };
      const resourcesApi = {
        importResources: vi.fn(() =>
          of<ResourceCommandResult>({ resources: [resA, resB] }),
        ),
      } satisfies ApiStub<ResourcesService>;
      const { service, query } = setup({ resources: resourcesApi }, [
        ws({ resources: [resA] }),
      ]);

      const import$ = service.import('w1', command);
      expect(query.getValue().loading).toBe(true);

      recordEmissions(import$);

      expect(resourcesApi.importResources).toHaveBeenCalledWith('w1', command);
      expect(query.getEntity('w1').resources).toEqual([resA, resB]);
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('loading flag on API errors', () => {
    // `failed` makes the call and resolves to the error it produced.
    const viaSubscriber =
      (call: (s: WorkspaceService) => Observable<unknown>) =>
      (s: WorkspaceService) =>
        firstValueFrom(call(s)).catch((e: unknown) => e);
    const rows: {
      method: string;
      apis: () => Apis;
      failed: (service: WorkspaceService) => Promise<unknown>;
    }[] = [
      {
        method: 'import',
        apis: () => ({ resources: { importResources: vi.fn(boom) } }),
        failed: viaSubscriber((s) =>
          s.import('w1', { resourceAddress: 'a', resourceId: 'b' }),
        ),
      },
      {
        method: 'saveState',
        apis: () => ({ runs: { saveState: vi.fn(boom) } }),
        failed: viaSubscriber((s) => s.saveState('r1')),
      },
      {
        method: 'loadRunsByWorkspaceId',
        apis: () => ({ runs: { getRunsByWorkspaceId: vi.fn(boom) } }),
        failed: viaSubscriber((s) => s.loadRunsByWorkspaceId('w1')),
      },
      {
        method: 'loadAllActiveRuns',
        apis: () => ({ runs: { getRuns: vi.fn(boom) } }),
        // Subscribes itself with no error callback, so the error escapes to
        // rxjs (in the app, to the ErrorHandler, ErrorService).
        failed: async (s) => {
          const escaped = captureUnhandledRxErrors();
          s.loadAllActiveRuns();
          await flush();
          expect(escaped).toHaveLength(1);
          return escaped[0];
        },
      },
      {
        method: 'loadResourcesByWorkspaceId',
        apis: () => ({ resources: { getResourcesByWorkspace: vi.fn(boom) } }),
        failed: viaSubscriber((s) => s.loadResourcesByWorkspaceId('w1')),
      },
      {
        method: 'refreshResources',
        apis: () => ({ resources: { refreshResources: vi.fn(boom) } }),
        failed: viaSubscriber((s) => s.refreshResources('w1')),
      },
    ];

    /**
     * Verifies: each loading-tracked call hands on the API error (to its
     *   subscriber, or unhandled for loadAllActiveRuns) and leaves the
     *   store's loading flag on.
     * Interacts with: the named generated API method (throwError stub);
     *   WorkspaceStore.setLoading; captureUnhandledRxErrors for
     *   loadAllActiveRuns.
     * Data: stored w1 (loading false); the API errors with 'boom'.
     */
    it.each(rows)(
      '$method leaves loading on when the API fails',
      async ({ apis, failed }) => {
        const { service, query } = setup(apis(), [ws()]);
        expect(query.getValue().loading).toBe(false);

        const error = await failed(service);

        expect(error).toEqual(new Error('boom'));
        expect(query.getValue().loading).toBe(true);
      },
    );
  });

  describe('setActive', () => {
    /**
     * Verifies: setActive(workspace) marks it active; setActive(null) clears
     *   the active workspace (a file or folder is active instead).
     * Interacts with: WorkspaceStore.setActive; WorkspaceQuery.getActiveId.
     * Data: stored w1.
     */
    it('sets and clears the active workspace', () => {
      const { service, query } = setup({}, [ws()]);

      service.setActive(ws());
      expect(query.getActiveId()).toBe('w1');

      service.setActive(null);
      expect(query.getActiveId()).toBeNull();
    });
  });

  describe('setStatusFilters', () => {
    const defaultFilters: StatusFilter[] = [
      'Queued',
      'Failed',
      'Rejected',
      'Planning',
      'Planned',
      'Applying',
      'Applied',
      'AppliedStateError',
      'FailedStateError',
      'ApplyQueued',
    ].map((key) => ({ key, filter: false }));

    /**
     * Verifies: given filters are stored on that workspace's UI state only.
     * Interacts with: WorkspaceStore.ui.update; WorkspaceQuery.filters$.
     * Data: stored w1 and w2; filters [Failed: true] for w1.
     */
    it('stores the given filters on the workspace', () => {
      const { service, query } = setup({}, [
        ws(),
        ws({ id: 'w2', name: 'Beta' }),
      ]);
      const filters: StatusFilter[] = [{ key: 'Failed', filter: true }];

      service.setStatusFilters('w1', filters);

      expect(query.ui.getEntity('w1').statusFilter).toEqual(filters);
      expect(query.ui.getEntity('w2').statusFilter).toEqual([]);
    });

    /**
     * Verifies: with no filters (undefined or []), the workspace gets one
     *   inactive filter per RunStatus *key*.
     * Interacts with: Object.keys(RunStatus) defaults.
     * Data: stored w1 and w2; setStatusFilters('w1'), setStatusFilters('w2', []).
     */
    it('falls back to an inactive filter per RunStatus key', () => {
      const { service, query } = setup({}, [
        ws(),
        ws({ id: 'w2', name: 'Beta' }),
      ]);

      service.setStatusFilters('w1');
      service.setStatusFilters('w2', []);

      expect(query.ui.getEntity('w1').statusFilter).toEqual(defaultFilters);
      expect(query.ui.getEntity('w2').statusFilter).toEqual(defaultFilters);
    });

    /**
     * Verifies: calling without filters overwrites filters the workspace
     *   already has.
     * Interacts with: WorkspaceQuery.ui.getValue (root UI state).
     * Data: w1 with [Failed: true]; setStatusFilters('w1').
     */
    it('overwrites existing filters with the defaults', () => {
      const { service, store, query } = setup({}, [ws()]);
      store.ui.update('w1', {
        statusFilter: [{ key: 'Failed', filter: true }],
      });

      service.setStatusFilters('w1');

      expect(query.ui.getEntity('w1').statusFilter).toEqual(defaultFilters);
    });
  });

  describe('createPlanRun', () => {
    /**
     * Verifies: creates a run for the workspace with the given flags, emits
     *   it, and expands it in the UI. The run itself arrives in the store later
     *   through the RunCreated hub event.
     * Interacts with: RunsService.createRun (stub); expandRun.
     * Data: stored w1; plan with one replace address and one target.
     */
    it('creates a run and expands it', () => {
      const created = run({ id: 'r1', status: RunStatus.Queued });
      const runsApi = {
        createRun: vi.fn(() => of(created)),
      } satisfies ApiStub<RunsService>;
      const { service, query } = setup({ runs: runsApi }, [ws()]);

      const seen = recordEmissions(
        service.createPlanRun('w1', false, ['aws_instance.a'], ['module.b']),
      );

      expect(runsApi.createRun).toHaveBeenCalledWith({
        workspaceId: 'w1',
        isDestroy: false,
        replaceAddresses: ['aws_instance.a'],
        targets: ['module.b'],
      });
      expect(seen).toEqual([created]);
      expect(query.ui.getEntity('w1').expandedRuns).toEqual(['r1']);
      expect(query.getEntity('w1').runs).toEqual([]);
    });

    /**
     * Verifies: the returned stream never completes, and when the workspace
     *   is removed it sends a second createRun with an undefined workspaceId.
     * Interacts with: WorkspaceQuery.selectEntity -> concatMap(createRun).
     * Data: stored w1; destroy plan subscribed without take(1) (as
     *   WorkspaceContainerComponent.destroy does); w1 renamed, then deleted.
     */
    it('sends another createRun when the workspace is removed', () => {
      const runsApi = {
        createRun: vi.fn((command: CreateRunCommand) =>
          command.workspaceId
            ? of(run({ isDestroy: true }))
            : throwError(() => new Error('400 Bad Request')),
        ),
      } satisfies ApiStub<RunsService>;
      const { service, store } = setup({ runs: runsApi }, [ws()]);
      let completed = false;
      let error: unknown;
      const subscription = service
        .createPlanRun('w1', true, null, null)
        .subscribe({
          complete: () => (completed = true),
          error: (err) => (error = err),
        });
      onTestFinished(() => subscription.unsubscribe());

      store.update('w1', { name: 'Renamed' });
      expect(runsApi.createRun).toHaveBeenCalledTimes(1);

      service.deleted('w1');

      expect(runsApi.createRun).toHaveBeenCalledTimes(2);
      expect(runsApi.createRun).toHaveBeenLastCalledWith({
        workspaceId: undefined,
        isDestroy: true,
        replaceAddresses: null,
        targets: null,
      });
      expect(error).toEqual(new Error('400 Bad Request'));
      expect(completed).toBe(false);
    });
  });

  describe('applyRun', () => {
    /**
     * Verifies: calls applyRun with the run id and emits the Apply, but does
     *   not expand anything in the UI.
     * Interacts with: AppliesService.applyRun (stub); expandRun.
     * Data: stored w1; the API returns Apply a1 for run r1 (no workspaceId).
     */
    it('applies the run without expanding it', () => {
      const apply: Apply = { id: 'a1', runId: 'r1', status: 'Queued' };
      const appliesApi = {
        applyRun: vi.fn(() => of(apply)),
      } satisfies ApiStub<AppliesService>;
      const { service, query } = setup({ applies: appliesApi }, [ws()]);

      const seen = recordEmissions(service.applyRun('w1', 'r1'));

      expect(appliesApi.applyRun).toHaveBeenCalledWith('r1');
      expect(seen).toEqual([apply]);
      expect(query.ui.getEntity('w1').expandedRuns).toEqual([]);
      expect(query.ui.getAll().map((u) => u.id)).toEqual(['w1']);
    });
  });

  describe('rejectRun and cancelRun', () => {
    /**
     * Verifies: rejectRun forwards the run id to the API and returns its
     *   response without touching the store.
     * Interacts with: RunsService.rejectRun (stub).
     * Data: stored w1 with run r1.
     */
    it('rejectRun() forwards to the Runs API', () => {
      const rejected = run({ status: RunStatus.Rejected });
      const runsApi = {
        rejectRun: vi.fn(() => of(rejected)),
      } satisfies ApiStub<RunsService>;
      const { service, query } = setup({ runs: runsApi }, [
        ws({ runs: [run()] }),
      ]);

      const seen = recordEmissions(service.rejectRun('w1', 'r1'));

      expect(runsApi.rejectRun).toHaveBeenCalledWith('r1');
      expect(seen).toEqual([rejected]);
      expect(query.getEntity('w1').runs).toEqual([run()]);
    });

    /**
     * Verifies: cancelRun forwards the run id and the force flag as a
     *   CancelRunCommand.
     * Interacts with: RunsService.cancelRun (stub).
     * Data: cancel r1 with force true, then r2 with force false.
     */
    it('cancelRun() sends the force flag', () => {
      const runsApi = {
        cancelRun: vi.fn(() => of(run())),
      } satisfies ApiStub<RunsService>;
      const { service } = setup({ runs: runsApi }, [ws()]);

      recordEmissions(service.cancelRun('w1', 'r1', true));
      recordEmissions(service.cancelRun('w1', 'r2', false));

      expect(runsApi.cancelRun.mock.calls).toEqual([
        ['r1', { force: true }],
        ['r2', { force: false }],
      ]);
    });
  });

  describe('saveState', () => {
    /**
     * Verifies: saveState turns loading on immediately, calls the API on
     *   subscribe and turns loading off when the run comes back.
     * Interacts with: RunsService.saveState (stub); store loading.
     * Data: stored w1 (loading false); save state of r1.
     */
    it('toggles loading around the save', () => {
      const runsApi = {
        saveState: vi.fn(() => of(run())),
      } satisfies ApiStub<RunsService>;
      const { service, query } = setup({ runs: runsApi }, [ws()]);

      const save$ = service.saveState('r1');
      expect(query.getValue().loading).toBe(true);

      const seen = recordEmissions(save$);

      expect(runsApi.saveState).toHaveBeenCalledWith('r1');
      expect(seen).toEqual([run()]);
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('selectRun', () => {
    /**
     * Verifies: selecting a run replaces the workspace's selection with that
     *   single run.
     * Interacts with: WorkspaceStore.ui.update; WorkspaceQuery.selectedRuns$.
     * Data: stored w1; select r1 then r2.
     */
    it('selects exactly one run', () => {
      const { service, query } = setup({}, [ws()]);
      const seen = recordEmissions(query.selectedRuns$('w1'));

      service.selectRun('w1', 'r1');
      service.selectRun('w1', 'r2');

      expect(seen).toEqual([[], ['r1'], ['r2']]);
    });
  });

  describe('loadRunsByWorkspaceId', () => {
    /**
     * Verifies: on subscribe, sets loading, requests the workspace's runs
     *   without plan or apply bodies, replaces the stored runs (adding
     *   displayStatus), and clears loading.
     * Interacts with: RunsService.getRunsByWorkspaceId (Subject stub).
     * Data: stored w1 with an old run; the API returns two Planned/Failed runs.
     */
    it('replaces the runs and toggles loading', () => {
      const response$ = new Subject<Run[]>();
      const runsApi = {
        getRunsByWorkspaceId: vi.fn(() => response$),
        getRunQueuePosition: vi.fn(() => of<QueuePosition>({ position: 1 })),
      } satisfies ApiStub<RunsService>;
      const { service, query } = setup({ runs: runsApi }, [
        ws({ runs: [run({ id: 'old' })] }),
      ]);

      const seen = recordEmissions(service.loadRunsByWorkspaceId('w1'));
      expect(runsApi.getRunsByWorkspaceId).toHaveBeenCalledWith(
        'w1',
        null,
        false,
        false,
      );
      expect(query.getValue().loading).toBe(true);

      const fetched = [
        run({ id: 'r1', status: RunStatus.Planned }),
        run({ id: 'r2', status: RunStatus.Failed }),
      ];
      response$.next(fetched);

      expect(seen).toEqual([fetched]);
      expect(query.getEntity('w1').runs).toEqual(
        fetched.map((r) => ({ ...r, displayStatus: r.status })),
      );
      expect(query.getValue().loading).toBe(false);
      expect(runsApi.getRunQueuePosition).not.toHaveBeenCalled();
    });

    /**
     * Verifies: only Queued and ApplyQueued runs fetch a queue position.
     * Interacts with: RunsService.getRunQueuePosition (stub).
     * Data: the API returns Queued r1, ApplyQueued r2 and Applying r3.
     */
    it('fetches queue positions for queued runs only', () => {
      const runsApi = {
        getRunsByWorkspaceId: vi.fn(() =>
          of([
            run({ id: 'r1', status: RunStatus.Queued }),
            run({ id: 'r2', status: RunStatus.ApplyQueued }),
            run({ id: 'r3', status: RunStatus.Applying }),
          ]),
        ),
        getRunQueuePosition: vi.fn((runId: string) =>
          of<QueuePosition>({ runId, workspaceId: 'w1', position: 7 }),
        ),
      } satisfies ApiStub<RunsService>;
      const { service, query } = setup({ runs: runsApi }, [ws()]);

      recordEmissions(service.loadRunsByWorkspaceId('w1'));

      expect(runsApi.getRunQueuePosition.mock.calls).toEqual([['r1'], ['r2']]);
      expect(query.getEntity('w1').runs.map((r) => r.displayStatus)).toEqual([
        'Queued (Position 7)',
        'Queued (Position 7)',
        RunStatus.Applying,
      ]);
    });
  });

  describe('loadAllActiveRuns', () => {
    /**
     * Verifies: fetches active runs, creates a skeleton workspace for each
     *   unknown workspace id, adds every run with displayStatus, keeps known
     *   workspaces' data, and clears loading.
     * Interacts with: RunsService.getRuns (stub); runUpdated.
     * Data: stored w1 'Alpha'; active runs r1 (w1), r2 and r3 (w9).
     */
    it('groups active runs into their workspaces', () => {
      const runsApi = {
        getRuns: vi.fn(() =>
          of([
            run({ id: 'r1', workspaceId: 'w1', status: RunStatus.Planning }),
            run({ id: 'r2', workspaceId: 'w9', status: RunStatus.Applying }),
            run({ id: 'r3', workspaceId: 'w9', status: RunStatus.Planning }),
          ]),
        ),
      } satisfies ApiStub<RunsService>;
      const { service, store, query } = setup({ runs: runsApi }, [ws()]);
      store.setLoading(true);

      service.loadAllActiveRuns();

      expect(runsApi.getRuns).toHaveBeenCalledWith(true);
      expect(query.getEntity('w1').name).toBe('Alpha');
      expect(query.getEntity('w1').runs.map((r) => r.id)).toEqual(['r1']);
      expect(query.getEntity('w9').runs.map((r) => r.displayStatus)).toEqual([
        RunStatus.Applying,
        RunStatus.Planning,
      ]);
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('resource loading', () => {
    /**
     * Verifies: loadResourcesByWorkspaceId replaces the workspace's resources
     *   with the API list and clears loading.
     * Interacts with: ResourcesService.getResourcesByWorkspace (stub).
     * Data: stored w1 with resource a; the API returns [b].
     */
    it('loadResourcesByWorkspaceId() replaces the resources', () => {
      const resourcesApi = {
        getResourcesByWorkspace: vi.fn(() => of([resB])),
      } satisfies ApiStub<ResourcesService>;
      const { service, query } = setup({ resources: resourcesApi }, [
        ws({ resources: [resA] }),
      ]);

      const seen = recordEmissions(service.loadResourcesByWorkspaceId('w1'));

      expect(resourcesApi.getResourcesByWorkspace).toHaveBeenCalledWith('w1');
      expect(seen).toEqual([[resB]]);
      expect(query.getEntity('w1').resources).toEqual([resB]);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: loadResource fetches one resource by address and merges it
     *   into the matching stored resource (matched on address), or appends it
     *   when no stored resource has that address.
     * Interacts with: ResourcesService.getResource (stub); arrayUpsert by
     *   'address'.
     * Data: stored resources a and b; detail for a; then a new resource c.
     */
    it('loadResource() upserts one resource by address', () => {
      const resC: Resource = {
        id: 'i-c',
        name: 'c',
        address: 'aws_instance.c',
      };
      const details: Record<string, Resource> = {
        [resA.address]: { ...resA, attributes: { ami: 'ami-1' } },
        [resC.address]: resC,
      };
      const resourcesApi = {
        getResource: vi.fn((_workspaceId: string, address: string) =>
          of(details[address]),
        ),
      } satisfies ApiStub<ResourcesService>;
      const { service, query } = setup({ resources: resourcesApi }, [
        ws({ resources: [resA, resB] }),
      ]);

      service.loadResource('w1', resA);
      service.loadResource('w1', resC);

      expect(resourcesApi.getResource.mock.calls).toEqual([
        ['w1', resA.address],
        ['w1', resC.address],
      ]);
      expect(query.getEntity('w1').resources).toEqual([
        { ...resA, attributes: { ami: 'ami-1' } },
        resB,
        resC,
      ]);
    });

    /**
     * Verifies: refreshResources sets loading, stores the refreshed resources
     *   and clears loading.
     * Interacts with: ResourcesService.refreshResources (stub).
     * Data: stored w1 with resource a; refresh returns [a tainted, b].
     */
    it('refreshResources() stores the refreshed resources', () => {
      const refreshed: ResourceCommandResult = {
        resources: [{ ...resA, tainted: true }, resB],
      };
      const resourcesApi = {
        refreshResources: vi.fn(() => of(refreshed)),
      } satisfies ApiStub<ResourcesService>;
      const { service, query } = setup({ resources: resourcesApi }, [
        ws({ resources: [resA] }),
      ]);

      const refresh$ = service.refreshResources('w1');
      expect(query.getValue().loading).toBe(true);
      recordEmissions(refresh$);

      expect(resourcesApi.refreshResources).toHaveBeenCalledWith('w1');
      expect(query.getEntity('w1').resources).toEqual(refreshed.resources);
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('UI state', () => {
    /**
     * Verifies: expandRun adds a run id once, ignores a repeat expand,
     *   removes it on collapse, and ignores collapsing a run that is not
     *   expanded.
     * Interacts with: WorkspaceStore.ui.upsert; arrayUpsert/arrayRemove.
     * Data: stored w1; runs r1 and r2.
     */
    it('expandRun() adds and removes expanded run ids', () => {
      const { service, query } = setup({}, [ws()]);
      const expanded = () => query.ui.getEntity('w1').expandedRuns;

      service.expandRun(true, run({ id: 'r1' }));
      service.expandRun(true, run({ id: 'r1' }));
      service.expandRun(true, run({ id: 'r2' }));
      expect(expanded()).toEqual(['r1', 'r2']);

      service.expandRun(false, run({ id: 'r1' }));
      service.expandRun(false, run({ id: 'r9' }));
      expect(expanded()).toEqual(['r2']);
    });

    /**
     * Verifies: expandResource toggles the resource address in
     *   expandedResources whatever the `expand` argument says.
     * Interacts with: WorkspaceStore.ui.upsert; arrayToggle.
     * Data: stored w1; expandResource(true, a) twice, then (false, b).
     */
    it('expandResource() toggles the address and ignores the expand flag', () => {
      const { service, query } = setup({}, [ws()]);
      const expanded = () => query.ui.getEntity('w1').expandedResources;

      service.expandResource(true, 'w1', resA);
      expect(expanded()).toEqual([resA.address]);

      // NOTE: `expand` is unused; a second expand collapses, and a collapse of
      // a collapsed resource expands it.
      service.expandResource(true, 'w1', resA);
      expect(expanded()).toEqual([]);
      service.expandResource(false, 'w1', resB);
      expect(expanded()).toEqual([resB.address]);
    });

    /**
     * Verifies: toggleIsExpanded flips the workspace's isExpanded flag and
     *   isExpanded reads it back.
     * Interacts with: WorkspaceStore.ui.upsert; WorkspaceQuery.ui.getEntity.
     * Data: stored w1 (collapsed by default).
     */
    it('toggleIsExpanded() flips isExpanded', () => {
      const { service } = setup({}, [ws()]);

      expect(service.isExpanded('w1')).toBe(false);
      service.toggleIsExpanded('w1');
      expect(service.isExpanded('w1')).toBe(true);
      service.toggleIsExpanded('w1');
      expect(service.isExpanded('w1')).toBe(false);
    });

    /**
     * Verifies: toggleIsExpanded and isExpanded throw for a workspace with no
     *   UI entity.
     * Interacts with: WorkspaceStore.ui.upsert (create branch).
     * Data: empty store.
     */
    it('toggleIsExpanded() throws for a workspace without UI state', () => {
      const { service } = setup();

      expect(() => service.toggleIsExpanded('missing')).toThrow(TypeError);
      expect(() => service.isExpanded('missing')).toThrow(TypeError);
    });

    /**
     * Verifies: setWorkspaceView switches the workspace between views.
     * Interacts with: WorkspaceStore.ui.upsert; WorkspaceQuery.getWorkspaceView.
     * Data: stored w1 (default 'runs'); switch to 'state'.
     */
    it('setWorkspaceView() switches the view', () => {
      const { service, query } = setup({}, [ws()]);
      const seen = recordEmissions(query.getWorkspaceView('w1'));

      service.setWorkspaceView('w1', 'state');

      expect(seen).toEqual(['runs', 'state']);
    });
  });

  describe('workspace locking', () => {
    /**
     * Verifies: loadLockingStatus stores the API's flag, and
     *   lockingEnabledUpdated (the WorkspaceSettingsUpdated hub event)
     *   overwrites it.
     * Interacts with: WorkspacesService.getWorkspaceLockingStatus (stub);
     *   WorkspaceStore root update.
     * Data: the API reports true; then a hub event with false.
     */
    it('loads the locking flag and applies hub updates', () => {
      const workspacesApi = {
        getWorkspaceLockingStatus: vi.fn(() => of(true)),
      } satisfies ApiStub<WorkspacesService>;
      const { service, query } = setup({ workspaces: workspacesApi });

      service.loadLockingStatus();
      expect(query.getValue().lockingEnabled).toBe(true);

      service.lockingEnabledUpdated(false);
      expect(query.getValue().lockingEnabled).toBe(false);
    });

    /**
     * Verifies: setLockingEnabled(true) calls enable, setLockingEnabled(false)
     *   calls disable, and the store takes the value the API returns.
     * Interacts with: WorkspacesService.enable/disableWorkspaceLocking (stubs).
     * Data: enable returns true; disable returns false.
     */
    it('enables or disables locking through the matching endpoint', () => {
      const workspacesApi = {
        enableWorkspaceLocking: vi.fn(() => of(true)),
        disableWorkspaceLocking: vi.fn(() => of(false)),
      } satisfies ApiStub<WorkspacesService>;
      const { service, query } = setup({ workspaces: workspacesApi });

      service.setLockingEnabled(true);
      expect(workspacesApi.enableWorkspaceLocking).toHaveBeenCalledTimes(1);
      expect(workspacesApi.disableWorkspaceLocking).not.toHaveBeenCalled();
      expect(query.getValue().lockingEnabled).toBe(true);

      service.setLockingEnabled(false);
      expect(workspacesApi.disableWorkspaceLocking).toHaveBeenCalledTimes(1);
      expect(query.getValue().lockingEnabled).toBe(false);
    });
  });
});
