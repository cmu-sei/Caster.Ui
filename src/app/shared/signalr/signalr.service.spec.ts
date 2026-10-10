// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import {
  Design,
  DesignModule,
  Directory,
  GroupMembership,
  GroupMembershipRole,
  ModelFile,
  Partition,
  Pool,
  ProjectMembership,
  QueuePosition,
  Run,
  RunStatus,
  RunsService,
  SystemRole,
  Variable,
  VariableType,
  Vlan,
  Workspace,
} from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { DesignQuery } from '../../designs/state/design.query';
import { DesignModuleQuery } from '../../designs/state/design-modules/design-module.query';
import { VariablesQuery } from '../../designs/state/variables/variables.query';
import { DirectoryQuery } from '../../directories/state/directory.query';
import { FileQuery } from '../../files/state/file.query';
import { FileStore } from '../../files/state/file.store';
import { GroupMembershipService } from '../../groups/group-membership.service';
import { ProjectMembershipService } from '../../project/state/project-membership.service';
import { ProjectObjectType, Tab } from '../../project/state/project.model';
import { ProjectQuery } from '../../project/state/project-query.service';
import { ProjectStore } from '../../project/state/project-store.service';
import { RoleService } from '../../roles/roles.service.service';
import { PartitionQuery } from '../../vlans/state/partition/partition.query';
import { PoolQuery } from '../../vlans/state/pool/pool.query';
import { VlanQuery } from '../../vlans/state/vlan/vlan.query';
import { WorkspaceQuery } from '../../workspace/state/workspace.query';
import { WorkspaceStore } from '../../workspace/state/workspace.store';
import {
  FakeHubConnection,
  mockHubConnectionBuilder,
  rejectInvokes,
} from '../../test-utils/fake-hub-connection';
import {
  captureUnhandledRejections,
  flush,
} from '../../test-utils/unhandled-rx-errors';
import { SignalRService } from './signalr.service';

// ---------------------------------------------------------------------------
// Hub connection (the shared FakeHubConnection)
// ---------------------------------------------------------------------------

// `builder.connections.length` is the number of connections built.
let builder: ReturnType<typeof mockHubConnectionBuilder>;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const API_URL = 'https://caster.test';

function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * The real SignalRService with its real collaborators (state services, Akita
 * stores and queries, and the BehaviorSubject-backed role/membership
 * services). Only the hub connection, the settings and the auth token are
 * faked; every generated API service stays an `unstubbed()` placeholder.
 */
function setup(extraProviders: Provider[] = []) {
  const auth = { token: 'token-1' };
  const authStub: Pick<ComnAuthService, 'getAuthorizationToken'> = {
    getAuthorizationToken: () => auth.token,
  };
  const settingsStub: Pick<ComnSettingsService, 'settings'> = {
    settings: { ApiUrl: API_URL },
  };
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: ComnSettingsService, useValue: settingsStub },
      { provide: ComnAuthService, useValue: authStub },
      // The real service, replacing the default placeholder.
      SignalRService,
      ...extraProviders,
    ]),
  });
  return { service: TestBed.inject(SignalRService), auth };
}

/** setup() plus a started connection in the Connected state. */
async function connected(extraProviders: Provider[] = []) {
  const ctx = setup(extraProviders);
  await ctx.service.startConnection();
  const hub = builder.connections[0];
  hub.invoke.mockClear();
  return { ...ctx, hub };
}

// Fixtures

function file(overrides: Partial<ModelFile> = {}): ModelFile {
  return {
    id: 'f1',
    name: 'main.tf',
    directoryId: 'd1',
    workspaceId: null,
    content: 'resource "x" "y" {}',
    lockedById: null,
    isDeleted: false,
    ...overrides,
  };
}

function tab(id: string): Tab {
  return {
    id,
    type: ProjectObjectType.FILE,
    name: id,
    directoryId: 'd1',
    breadcrumb: [],
  };
}

/** Seeds an active project with the given open tabs. */
function openTabs(ids: string[], selectedTab: number) {
  const store = TestBed.inject(ProjectStore);
  store.set([{ id: 'p1', name: 'Project' }]);
  store.setActive('p1');
  store.ui.update('p1', { openTabs: ids.map(tab), selectedTab });
}

function openTabIds(): string[] {
  return TestBed.inject(ProjectQuery)
    .ui.getEntity('p1')
    .openTabs.map((t) => t.id);
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: 'r1',
    workspaceId: 'w1',
    status: RunStatus.Planning,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** A workspace as the API sends it: the view model has no `runs`. */
function apiWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'w1',
    name: 'Alpha',
    directoryId: 'd1',
    ...overrides,
  } as Workspace;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignalRService', () => {
  beforeEach(() => {
    // Tests that must control a connection before start() call
    // mockHubConnectionBuilder({ onBuild }) again, which replaces this one.
    builder = mockHubConnectionBuilder();
    // joinWorkspace/leaveWorkspace log swallowed errors; keep output clean.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  describe('startConnection()', () => {
    /**
     * Verifies: the hub URL is the API URL plus /hubs/project, and the access token factory reads the current token on every call.
     * Interacts with: HubConnectionBuilder.withUrl (spied), ComnAuthService.getAuthorizationToken (stub), ComnSettingsService.settings.ApiUrl.
     * Data: ApiUrl 'https://caster.test'; the token changes from 'token-1' to 'token-2' after the connection is built.
     */
    it('connects to <ApiUrl>/hubs/project with a token factory that reads the current token', async () => {
      const { service, auth } = setup();

      await service.startConnection();

      expect(builder.withUrl).toHaveBeenCalledTimes(1);
      const [url, options] = builder.withUrl.mock.calls[0];
      expect(url).toBe(`${API_URL}/hubs/project`);
      expect(options.accessTokenFactory()).toBe('token-1');
      // Lazily evaluated, so a refreshed token is used on the next (re)connect.
      auth.token = 'token-2';
      expect(options.accessTokenFactory()).toBe('token-2');
    });

    /**
     * Verifies: automatic reconnect uses an exponential backoff of 2^(n+1) seconds, capped at 60, plus 0-5 seconds of jitter.
     * Interacts with: HubConnectionBuilder.withAutomaticReconnect (spied) and the RetryPolicy it receives; Math.random (spied).
     * Data: previousRetryCount 0, 1, 4, 5 and 50 with Math.random at 0, then 0.999.
     */
    it('reconnects with capped exponential backoff plus jitter, and never gives up', async () => {
      const { service } = setup();
      await service.startConnection();
      const policy = builder.retryPolicy();
      if (!policy) throw new Error('withAutomaticReconnect got no policy');
      const delay = (previousRetryCount: number) =>
        policy.nextRetryDelayInMilliseconds({
          previousRetryCount,
          elapsedMilliseconds: 0,
          retryReason: new Error('dropped'),
        });

      const random = vi.spyOn(Math, 'random').mockReturnValue(0);
      expect([0, 1, 4, 5, 50].map(delay)).toEqual([
        2000, 4000, 32000, 60000, 60000,
      ]);

      random.mockReturnValue(0.999);
      expect([0, 5].map(delay)).toEqual([7000, 65000]);
      // The policy returns a delay for every retry count (no null), so a
      // client that can't reach the hub keeps retrying every ~60-65 seconds
      // while the tab is open.
    });

    /**
     * Verifies: a second startConnection() returns the cached promise without building or starting another connection.
     * Interacts with: mockHubConnectionBuilder connections (build count), FakeHubConnection.start.
     * Data: two calls, the first still pending when the second is made.
     */
    it('builds and starts the hub once, sharing the promise between callers', async () => {
      const { service } = setup();

      const first = service.startConnection();
      const second = service.startConnection();
      await first;

      expect(second).toBe(first);
      expect(builder.connections.length).toBe(1);
      expect(builder.connections[0].start).toHaveBeenCalledTimes(1);
    });

    /**
     * Verifies: every hub event the service listens to is registered exactly once, before start() is called.
     * Interacts with: FakeHubConnection.on (spied), FakeHubConnection.start.
     * Data: the full list of client event names, compared with what caster.api sends.
     */
    it('registers one handler per hub event before starting', async () => {
      const { service } = setup();
      const on = vi.spyOn(FakeHubConnection.prototype, 'on');
      let registeredAtStart: string[] = [];
      builder = mockHubConnectionBuilder({
        onBuild: (hub) =>
          hub.start.mockImplementation(() => {
            registeredAtStart = on.mock.calls.map(([event]) => event);
            hub.state = signalR.HubConnectionState.Connected;
            return Promise.resolve();
          }),
      });

      await service.startConnection();
      const hub = builder.connections[0];

      const crud = (prefix: string) => [
        `${prefix}Created`,
        `${prefix}Updated`,
        `${prefix}Deleted`,
      ];
      expect(registeredAtStart).toEqual([
        ...crud('File'),
        ...crud('Directory'),
        ...crud('Workspace'),
        'WorkspaceSettingsUpdated',
        'RunCreated',
        'RunUpdated',
        'RunQueuePositionUpdated',
        ...crud('Design'),
        ...crud('Variable'),
        ...crud('DesignModule'),
        ...crud('Pool'),
        ...crud('Partition'),
        ...crud('Vlan'),
        ...crud('Role'),
        ...crud('GroupMembership'),
        ...crud('ProjectMembership'),
      ]);
      expect(hub.start).toHaveBeenCalledTimes(1);
      // RunDeleted is not listened to; see agent-docs/ui-test-bugs/caster.ui.md, API gaps noticed.
    });

    /**
     * Verifies: a join made while the connection is still starting is stored and sent once start() resolves.
     * Interacts with: FakeHubConnection.start (pending), FakeHubConnection.invoke, the private JoinGroups.
     * Data: joinWorkspace('w1') called while the state is Connecting (as WorkspaceContainerComponent does).
     */
    it('sends joins made while connecting once the connection starts', async () => {
      const start = deferred();
      builder = mockHubConnectionBuilder({
        onBuild: (hub) =>
          hub.start.mockImplementation(() => {
            hub.state = signalR.HubConnectionState.Connecting;
            return start.promise.then(() => {
              hub.state = signalR.HubConnectionState.Connected;
            });
          }),
      });
      const { service } = setup();

      const started = service.startConnection();
      const hub = builder.connections[0];
      expect(hub.state).toBe(signalR.HubConnectionState.Connecting);
      service.joinWorkspace('w1');
      expect(hub.invoke.mock.calls).toEqual([]);

      start.resolve();
      await started;
      await flush();

      expect(hub.invoke.mock.calls).toEqual([['JoinWorkspace', 'w1']]);
    });

    /**
     * Verifies: a failed start() is cached, so later calls get the same rejected promise and no new connection is built or started.
     * Interacts with: FakeHubConnection.start (rejecting), mockHubConnectionBuilder connections, captureUnhandledRejections.
     * Data: start() rejects with Error('hub offline'); startConnection() is called twice.
     */
    it('caches a failed start instead of retrying it', async () => {
      // The JoinGroups chain's rejection is covered by the next test.
      const unhandled = captureUnhandledRejections();
      const offline = new Error('hub offline');
      builder = mockHubConnectionBuilder({
        onBuild: (hub) => hub.start.mockRejectedValue(offline),
      });
      const { service } = setup();

      await expect(service.startConnection()).rejects.toBe(offline);
      await expect(service.startConnection()).rejects.toBe(offline);
      await flush();

      expect(builder.connections.length).toBe(1);
      expect(builder.connections[0].start).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([offline]);
    });

    /**
     * Verifies: when start() fails, the service's own `.then(JoinGroups)` chain leaves an unhandled rejection even though the caller handles the returned promise.
     * Interacts with: FakeHubConnection.start (rejecting), captureUnhandledRejections (zone.js reports via console.error).
     * Data: start() rejects with Error('hub offline'); the caller catches the rejection.
     */
    it('leaves an unhandled rejection from its JoinGroups chain when start fails', async () => {
      const unhandled = captureUnhandledRejections();
      const offline = new Error('hub offline');
      builder = mockHubConnectionBuilder({
        onBuild: (hub) => hub.start.mockRejectedValue(offline),
      });
      const { service } = setup();

      await expect(service.startConnection()).rejects.toBe(offline);
      await flush();

      expect(unhandled).toEqual([offline]);
    });
  });

  describe('joining and leaving groups', () => {
    const joins: Array<{
      join: (s: SignalRService) => void;
      expected: unknown[];
    }> = [
      { join: (s) => s.joinProject('p1'), expected: ['JoinProject', 'p1'] },
      {
        join: (s) => s.joinProjectAdmin('p1'),
        expected: ['JoinProjectAdmin', 'p1'],
      },
      { join: (s) => s.joinGroup('g1'), expected: ['JoinGroup', 'g1'] },
      {
        join: (s) => s.joinWorkspace('w1'),
        expected: ['JoinWorkspace', 'w1'],
      },
      {
        join: (s) => s.joinWorkspacesAdmin(),
        expected: ['JoinWorkspacesAdmin'],
      },
      { join: (s) => s.joinDesign('de1'), expected: ['JoinDesign', 'de1'] },
      { join: (s) => s.joinVlansAdmin(), expected: ['JoinVlansAdmin'] },
      { join: (s) => s.joinRolesAdmin(), expected: ['JoinRolesAdmin'] },
    ];

    const leaves: Array<{
      leave: (s: SignalRService) => void;
      expected: unknown[];
    }> = [
      { leave: (s) => s.leaveProject('p1'), expected: ['LeaveProject', 'p1'] },
      {
        leave: (s) => s.leaveProjectAdmin('p1'),
        expected: ['LeaveProjectAdmin', 'p1'],
      },
      { leave: (s) => s.leaveGroup('g1'), expected: ['LeaveGroup', 'g1'] },
      {
        leave: (s) => s.leaveWorkspace('w1'),
        expected: ['LeaveWorkspace', 'w1'],
      },
      {
        leave: (s) => s.leaveWorkspacesAdmin(),
        expected: ['LeaveWorkspacesAdmin'],
      },
      { leave: (s) => s.leaveDesign('de1'), expected: ['LeaveDesign', 'de1'] },
      { leave: (s) => s.leaveVlansAdmin(), expected: ['LeaveVlansAdmin'] },
      { leave: (s) => s.leaveRolesAdmin(), expected: ['LeaveRolesAdmin'] },
    ];

    /**
     * Verifies: each join method invokes its hub method with its argument while the connection is Connected.
     * Interacts with: FakeHubConnection.invoke.
     * Data: one join per row; the expected [method, ...args] tuple matches caster.api's ProjectHub.
     */
    it.each(joins)(
      'invokes $expected.0 while connected',
      async ({ join, expected }) => {
        const { service, hub } = await connected();

        join(service);

        expect(hub.invoke.mock.calls).toEqual([expected]);
      },
    );

    /**
     * Verifies: each leave method invokes its hub method with its argument while the connection is Connected.
     * Interacts with: FakeHubConnection.invoke.
     * Data: one leave per row; the expected [method, ...args] tuple matches caster.api's ProjectHub.
     */
    it.each(leaves)(
      'invokes $expected.0 while connected',
      async ({ leave, expected }) => {
        const { service, hub } = await connected();

        leave(service);

        expect(hub.invoke.mock.calls).toEqual([expected]);
      },
    );

    /**
     * Verifies: join and leave calls made while the hub is disconnected (reconnecting) invoke nothing.
     * Interacts with: FakeHubConnection.state, FakeHubConnection.invoke.
     * Data: state set to Reconnecting, then every join and leave method called.
     */
    it('invokes nothing while the hub is not connected', async () => {
      const { service, hub } = await connected();
      hub.state = signalR.HubConnectionState.Reconnecting;

      joins.forEach(({ join }) => join(service));
      leaves.forEach(({ leave }) => leave(service));

      expect(hub.invoke.mock.calls).toEqual([]);
    });

    /**
     * Verifies: join methods throw a TypeError when called before startConnection(), while leave methods are safe no-ops.
     * Interacts with: SignalRService only (no connection has been built).
     * Data: every join and leave method, with no prior startConnection().
     */
    it('throws from join methods before startConnection(); leave methods are no-ops', () => {
      const { service } = setup();

      // join* read `this.hubConnection.state` without `?.`, unlike leave*.
      // Every caller starts the connection first (most via
      // startConnection().then(...)), so no caller reaches the throw.
      joins.forEach(({ join }) =>
        expect(() => join(service)).toThrow(TypeError),
      );
      leaves.forEach(({ leave }) => expect(() => leave(service)).not.toThrow());
      expect(builder.connections.length).toBe(0);
    });

    /**
     * Verifies: after an automatic reconnect, every group still joined is re-joined in JoinGroups order, and groups that were left are not.
     * Interacts with: FakeHubConnection.onreconnected callback, FakeHubConnection.invoke.
     * Data: every join made while connected (two workspaces, two designs); then project, w2 and de2 are left before the reconnect.
     */
    it('re-joins the remaining groups after a reconnect', async () => {
      const { service, hub } = await connected();
      joins.forEach(({ join }) => join(service));
      service.joinWorkspace('w2');
      service.joinDesign('de2');
      service.leaveProject('p1');
      service.leaveWorkspace('w2');
      service.leaveDesign('de2');
      hub.invoke.mockClear();

      hub.state = signalR.HubConnectionState.Reconnecting;
      hub.reconnect();
      await flush();

      expect(hub.invoke.mock.calls).toEqual([
        ['JoinGroup', 'g1'],
        ['JoinWorkspace', 'w1'],
        ['JoinWorkspacesAdmin'],
        ['JoinDesign', 'de1'],
        ['JoinVlansAdmin'],
        ['JoinRolesAdmin'],
        ['JoinProjectAdmin', 'p1'],
      ]);
    });

    /**
     * Verifies: a project that is still joined at reconnect time is re-joined first, before the other groups.
     * Interacts with: FakeHubConnection.onreconnected callback, FakeHubConnection.invoke.
     * Data: joinProject('p1') and joinGroup('g1') while connected; then a reconnect.
     */
    it('re-joins a still-joined project first after a reconnect', async () => {
      const { service, hub } = await connected();
      service.joinGroup('g1');
      service.joinProject('p1');
      hub.invoke.mockClear();

      hub.state = signalR.HubConnectionState.Reconnecting;
      hub.reconnect();
      await flush();

      expect(hub.invoke.mock.calls).toEqual([
        ['JoinProject', 'p1'],
        ['JoinGroup', 'g1'],
      ]);
    });

    /**
     * Verifies: after leaving everything, a reconnect re-joins nothing.
     * Interacts with: FakeHubConnection.onreconnected callback, FakeHubConnection.invoke.
     * Data: every join, then every leave, then a reconnect.
     */
    it('re-joins nothing after every group was left', async () => {
      const { service, hub } = await connected();
      joins.forEach(({ join }) => join(service));
      leaves.forEach(({ leave }) => leave(service));
      hub.invoke.mockClear();

      hub.reconnect();

      expect(hub.invoke.mock.calls).toEqual([]);
    });

    /**
     * Verifies: a rejected JoinWorkspace or LeaveWorkspace from joinWorkspace/leaveWorkspace is logged and swallowed.
     * Interacts with: FakeHubConnection.invoke (rejecting), console.log (spied), zone.js rejection reporting (console.error).
     * Data: the hub rejects both calls with Error('workspace not found').
     */
    it('logs and swallows a rejected JoinWorkspace or LeaveWorkspace', async () => {
      const unhandled = captureUnhandledRejections();
      const { service, hub } = await connected();
      const notFound = new Error('workspace not found');
      rejectInvokes(hub, notFound);

      service.joinWorkspace('stale');
      service.leaveWorkspace('stale');
      await flush();

      expect(vi.mocked(console.log).mock.calls).toEqual([
        [notFound],
        [notFound],
      ]);
      expect(unhandled).toEqual([]);
    });

    // Hub invokes with no `.catch`, one row per call site. `arrange` runs
    // while invokes still resolve; `act` runs once they reject.
    const uncaught: Array<{
      method: string;
      line: number;
      arrange?: (s: SignalRService) => void;
      act: (s: SignalRService, hub: FakeHubConnection) => void;
      expected: unknown[];
    }> = [
      {
        method: 'joinProject',
        line: 141,
        act: (s) => s.joinProject('p1'),
        expected: ['JoinProject', 'p1'],
      },
      {
        method: 'leaveProject',
        line: 148,
        act: (s) => s.leaveProject('p1'),
        expected: ['LeaveProject', 'p1'],
      },
      {
        method: 'joinProjectAdmin',
        line: 156,
        act: (s) => s.joinProjectAdmin('p1'),
        expected: ['JoinProjectAdmin', 'p1'],
      },
      {
        method: 'leaveProjectAdmin',
        line: 163,
        act: (s) => s.leaveProjectAdmin('p1'),
        expected: ['LeaveProjectAdmin', 'p1'],
      },
      {
        method: 'joinGroup',
        line: 171,
        act: (s) => s.joinGroup('g1'),
        expected: ['JoinGroup', 'g1'],
      },
      {
        method: 'leaveGroup',
        line: 178,
        act: (s) => s.leaveGroup('g1'),
        expected: ['LeaveGroup', 'g1'],
      },
      {
        method: 'JoinGroups (re-join JoinWorkspace)',
        line: 107,
        arrange: (s) => s.joinWorkspace('stale'),
        act: (_s, hub) => hub.reconnect(),
        expected: ['JoinWorkspace', 'stale'],
      },
      {
        method: 'joinWorkspacesAdmin',
        line: 208,
        act: (s) => s.joinWorkspacesAdmin(),
        expected: ['JoinWorkspacesAdmin'],
      },
      {
        method: 'leaveWorkspacesAdmin',
        line: 215,
        act: (s) => s.leaveWorkspacesAdmin(),
        expected: ['LeaveWorkspacesAdmin'],
      },
      {
        method: 'JoinGroups (re-join JoinDesign)',
        line: 119,
        arrange: (s) => s.joinDesign('de1'),
        act: (_s, hub) => hub.reconnect(),
        expected: ['JoinDesign', 'de1'],
      },
      {
        method: 'joinDesign',
        line: 223,
        act: (s) => s.joinDesign('de1'),
        expected: ['JoinDesign', 'de1'],
      },
      {
        method: 'leaveDesign',
        line: 230,
        act: (s) => s.leaveDesign('de1'),
        expected: ['LeaveDesign', 'de1'],
      },
      {
        method: 'joinVlansAdmin',
        line: 238,
        act: (s) => s.joinVlansAdmin(),
        expected: ['JoinVlansAdmin'],
      },
      {
        method: 'leaveVlansAdmin',
        line: 245,
        act: (s) => s.leaveVlansAdmin(),
        expected: ['LeaveVlansAdmin'],
      },
      {
        method: 'joinRolesAdmin',
        line: 253,
        act: (s) => s.joinRolesAdmin(),
        expected: ['JoinRolesAdmin'],
      },
      {
        method: 'leaveRolesAdmin',
        line: 260,
        act: (s) => s.leaveRolesAdmin(),
        expected: ['LeaveRolesAdmin'],
      },
    ];

    /**
     * Verifies: a rejected hub invoke from each call site without a `.catch` leaves exactly one unhandled rejection (current behavior).
     * Interacts with: FakeHubConnection.invoke (rejectInvokes), FakeHubConnection.onreconnected callback for the JoinGroups rows, captureUnhandledRejections.
     * Data: one call site per row; the hub rejects every invoke with Error('hub refused') after `arrange` ran.
     */
    it.each(uncaught)(
      '$method (signalr.service.ts:$line) leaves a rejected invoke unhandled',
      async ({ arrange, act, expected }) => {
        const unhandled = captureUnhandledRejections();
        const { service, hub } = await connected();
        arrange?.(service);
        const refused = new Error('hub refused');
        const calls = rejectInvokes(hub, refused);

        act(service, hub);
        await flush();

        expect(calls).toEqual([expected]);
        expect(unhandled).toEqual([refused]);
      },
    );
  });

  describe('output streams', () => {
    /**
     * Verifies: streamPlanOutput and streamApplyOutput call hub.stream with GetPlanOutput / GetApplyOutput and return the hub's stream.
     * Interacts with: FakeHubConnection.stream.
     * Data: plan id 'plan-1' and apply id 'apply-1'; each stream() call returns a new Subject.
     */
    it('streams plan and apply output from the hub', async () => {
      const { service, hub } = await connected();
      hub.stream.mockImplementation(() => new Subject<unknown>());

      const plan = service.streamPlanOutput('plan-1');
      const apply = service.streamApplyOutput('apply-1');

      expect(hub.stream.mock.calls).toEqual([
        ['GetPlanOutput', 'plan-1'],
        ['GetApplyOutput', 'apply-1'],
      ]);
      expect(plan).toBe(hub.stream.mock.results[0].value);
      expect(apply).toBe(hub.stream.mock.results[1].value);
    });

    /**
     * Verifies: the stream methods throw before startConnection(); RunComponent therefore calls them inside startConnection().then().
     * Interacts with: SignalRService only.
     * Data: no connection built.
     */
    it('throws from the stream methods before startConnection()', () => {
      const { service } = setup();

      expect(() => service.streamPlanOutput('plan-1')).toThrow(TypeError);
      expect(() => service.streamApplyOutput('apply-1')).toThrow(TypeError);
    });
  });

  describe('file events', () => {
    /**
     * Verifies: FileCreated stores the file through FileService and marks it saved.
     * Interacts with: FileService.fileUpdated, FileStore, FileQuery (real).
     * Data: a new file 'f1'.
     */
    it('FileCreated adds the file and marks it saved', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(FileQuery);

      hub.trigger('FileCreated', file(), []);

      expect(query.getEntity('f1')).toMatchObject(file());
      expect(query.ui.getEntity('f1')).toMatchObject({ isSaved: true });
    });

    /**
     * Verifies: FileUpdated for a live file merges the payload into the stored file and leaves open tabs alone.
     * Interacts with: FileService.fileUpdated, ProjectService (not called), FileQuery, ProjectQuery (real).
     * Data: stored 'f1' named main.tf; payload renames it to vars.tf; tabs [f1, f2] are open.
     */
    it('FileUpdated merges a live file and keeps its tab open', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(FileQuery);
      TestBed.inject(FileStore).add(file());
      openTabs(['f1', 'f2'], 0);

      hub.trigger('FileUpdated', file({ name: 'vars.tf' }), ['Name']);

      expect(query.getEntity('f1').name).toBe('vars.tf');
      expect(openTabIds()).toEqual(['f1', 'f2']);
    });

    /**
     * Verifies: FileUpdated with content null (caster.api omits Content unless it changed) replaces the stored content with null.
     * Interacts with: FileService.fileUpdated, FileQuery (real).
     * Data: stored 'f1' with content; payload locks the file and carries content: null, modifiedProperties ['LockedById'].
     */
    it('FileUpdated without content stores content as null', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(FileQuery);
      TestBed.inject(FileStore).add(file());

      hub.trigger('FileUpdated', file({ content: null, lockedById: 'u2' }), [
        'LockedById',
      ]);

      // NOTE: the payload replaces the content (modifiedProperties is ignored
      // for files). ProjectTabComponent reloads a file whose content is null,
      // which seems to be how the app copes with this.
      expect(query.getEntity('f1')).toMatchObject({
        content: null,
        lockedById: 'u2',
      });
    });

    /**
     * Verifies: FileUpdated with isDeleted removes the file and closes its tab, moving the selection back when needed.
     * Interacts with: ProjectService.closeTab, FileService.fileDeleted, ProjectStore/ProjectQuery, FileStore/FileQuery (real).
     * Data: tabs [f1, f2, f3] with the last selected; 'f3' arrives with isDeleted true.
     */
    it('FileUpdated with isDeleted removes the file and closes its tab', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(FileQuery);
      TestBed.inject(FileStore).add(file({ id: 'f3' }));
      openTabs(['f1', 'f2', 'f3'], 2);

      hub.trigger('FileUpdated', file({ id: 'f3', isDeleted: true }), [
        'IsDeleted',
      ]);

      expect(query.hasEntity('f3')).toBe(false);
      expect(openTabIds()).toEqual(['f1', 'f2']);
      expect(TestBed.inject(ProjectQuery).ui.getEntity('p1').selectedTab).toBe(
        1,
      );
    });

    /**
     * Verifies: FileDeleted removes the file and closes only its tab.
     * Interacts with: ProjectService.closeTab, FileService.fileDeleted, ProjectQuery, FileQuery (real).
     * Data: tabs [f1, f2, f3]; FileDeleted('f2').
     */
    it('FileDeleted removes the file and closes its tab', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(FileQuery);
      TestBed.inject(FileStore).add(file({ id: 'f2' }));
      openTabs(['f1', 'f2', 'f3'], 0);

      hub.trigger('FileDeleted', 'f2');

      expect(query.hasEntity('f2')).toBe(false);
      expect(openTabIds()).toEqual(['f1', 'f3']);
    });

    /**
     * Verifies: deleting a file that has no open tab closes the last open tab instead of leaving the tabs alone.
     * Interacts with: ProjectService.closeTab, ProjectQuery (real).
     * Data: tabs [f1, f2, f3]; FileDeleted('not-open').
     */
    it('FileDeleted for a file with no tab closes the last tab', async () => {
      const { hub } = await connected();
      openTabs(['f1', 'f2', 'f3'], 0);

      hub.trigger('FileDeleted', 'not-open');

      // closeTab's splice(-1, 1) drops the last tab (see 'removes the last tab
      // for an id that is not open' in project.service.spec.ts), so any other
      // user deleting any file in the project closes it.
      expect(openTabIds()).toEqual(['f1', 'f2']);
    });

    /**
     * Verifies: file deletions still update the file store when no project is active.
     * Interacts with: ProjectService.closeTab (no active project), FileService.fileDeleted, FileQuery (real).
     * Data: stored 'f1', no active project; FileDeleted('f1').
     */
    it('FileDeleted without an active project only removes the file', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(FileQuery);
      TestBed.inject(FileStore).add(file());

      expect(() => hub.trigger('FileDeleted', 'f1')).not.toThrow();
      expect(query.hasEntity('f1')).toBe(false);
    });
  });

  describe('directory events', () => {
    const directory: Directory = { id: 'd1', name: 'root', projectId: 'p1' };

    /**
     * Verifies: DirectoryCreated and DirectoryUpdated upsert the directory, which gets the initial directory UI state.
     * Interacts with: DirectoryService.updated, DirectoryStore/DirectoryQuery (real).
     * Data: 'd1' created as 'root', then updated to 'renamed'.
     */
    it('DirectoryCreated and DirectoryUpdated upsert the directory', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(DirectoryQuery);

      hub.trigger('DirectoryCreated', directory, null);
      expect(query.getEntity('d1')).toEqual(directory);
      expect(query.ui.getEntity('d1')).toMatchObject({ isExpanded: false });

      hub.trigger('DirectoryUpdated', { ...directory, name: 'renamed' }, [
        'Name',
      ]);
      expect(query.getEntity('d1').name).toBe('renamed');
    });

    /**
     * Verifies: DirectoryDeleted removes the directory and its UI entity.
     * Interacts with: DirectoryService.deleted, DirectoryStore/DirectoryQuery (real).
     * Data: 'd1' created first, then DirectoryDeleted('d1').
     */
    it('DirectoryDeleted removes the directory and its UI state', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(DirectoryQuery);
      hub.trigger('DirectoryCreated', directory, null);

      hub.trigger('DirectoryDeleted', 'd1');

      expect(query.hasEntity('d1')).toBe(false);
      expect(query.ui.hasEntity('d1')).toBe(false);
    });
  });

  describe('workspace and run events', () => {
    /**
     * Verifies: WorkspaceCreated and WorkspaceUpdated upsert the workspace; an update keeps runs already in the store.
     * Interacts with: WorkspaceService.updated, WorkspaceStore/WorkspaceQuery (real).
     * Data: 'w1' stored with one run; WorkspaceUpdated renames it (API payload, no runs); WorkspaceCreated adds 'w2'.
     */
    it('WorkspaceCreated and WorkspaceUpdated upsert the workspace', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(WorkspaceQuery);
      TestBed.inject(WorkspaceStore).add({ ...apiWorkspace(), runs: [run()] });

      hub.trigger('WorkspaceUpdated', apiWorkspace({ name: 'Renamed' }), [
        'Name',
      ]);
      hub.trigger('WorkspaceCreated', apiWorkspace({ id: 'w2' }), []);

      expect(query.getEntity('w1')).toMatchObject({
        name: 'Renamed',
        runs: [run()],
      });
      expect(query.hasEntity('w2')).toBe(true);
    });

    /**
     * Verifies: WorkspaceDeleted removes the workspace.
     * Interacts with: WorkspaceService.deleted, WorkspaceQuery (real).
     * Data: stored 'w1'; WorkspaceDeleted('w1').
     */
    it('WorkspaceDeleted removes the workspace', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(WorkspaceQuery);
      TestBed.inject(WorkspaceStore).add({ ...apiWorkspace(), runs: [] });

      hub.trigger('WorkspaceDeleted', 'w1');

      expect(query.hasEntity('w1')).toBe(false);
    });

    /**
     * Verifies: WorkspaceSettingsUpdated sets the store-level lockingEnabled flag.
     * Interacts with: WorkspaceService.lockingEnabledUpdated, WorkspaceQuery (real).
     * Data: true, then false.
     */
    it('WorkspaceSettingsUpdated sets lockingEnabled', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(WorkspaceQuery);

      hub.trigger('WorkspaceSettingsUpdated', true);
      expect(query.getValue().lockingEnabled).toBe(true);

      hub.trigger('WorkspaceSettingsUpdated', false);
      expect(query.getValue().lockingEnabled).toBe(false);
    });

    /**
     * Verifies: RunCreated and RunUpdated upsert the run into its workspace with displayStatus set from status.
     * Interacts with: WorkspaceService.runUpdated, WorkspaceStore/WorkspaceQuery (real).
     * Data: 'w1' stored with runs []; run 'r1' created as Planning, then updated to Planned.
     */
    it('RunCreated and RunUpdated upsert the run with its display status', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(WorkspaceQuery);
      TestBed.inject(WorkspaceStore).add({ ...apiWorkspace(), runs: [] });

      hub.trigger('RunCreated', run(), null);
      expect(query.getEntity('w1').runs).toEqual([
        { ...run(), displayStatus: RunStatus.Planning },
      ]);

      hub.trigger('RunUpdated', run({ status: RunStatus.Planned }), ['Status']);
      expect(query.getEntity('w1').runs).toEqual([
        {
          ...run({ status: RunStatus.Planned }),
          displayStatus: RunStatus.Planned,
        },
      ]);
    });

    /**
     * Verifies: a queued run looks up its queue position, and RunQueuePositionUpdated rewrites displayStatus.
     * Interacts with: WorkspaceService.runUpdated/queuePositionUpdated, RunsService.getRunQueuePosition (stub), WorkspaceQuery (real).
     * Data: 'r1' arrives Queued; the API reports position 3; the hub then pushes position 1.
     */
    it('RunQueuePositionUpdated shows the queue position', async () => {
      const runsApi = {
        getRunQueuePosition: vi.fn((runId: string) =>
          of<QueuePosition>({ runId, workspaceId: 'w1', position: 3 }),
        ),
      } satisfies ApiStub<RunsService>;
      const { hub } = await connected([
        { provide: RunsService, useValue: runsApi },
      ]);
      const query = TestBed.inject(WorkspaceQuery);
      TestBed.inject(WorkspaceStore).add({ ...apiWorkspace(), runs: [] });

      hub.trigger('RunCreated', run({ status: RunStatus.Queued }), null);
      expect(runsApi.getRunQueuePosition).toHaveBeenCalledWith('r1');
      expect(query.getEntity('w1').runs[0].displayStatus).toBe(
        'Queued (Position 3)',
      );

      hub.trigger('RunQueuePositionUpdated', {
        runId: 'r1',
        workspaceId: 'w1',
        position: 1,
      });
      expect(query.getEntity('w1').runs[0].displayStatus).toBe(
        'Queued (Position 1)',
      );
    });

    /**
     * Verifies: a run for a workspace that isn't in the store creates a stub workspace holding the run.
     * Interacts with: WorkspaceService.runUpdated, WorkspaceQuery (real).
     * Data: empty store; RunCreated for workspace 'w9'.
     */
    it('RunCreated for an unknown workspace adds a stub workspace', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(WorkspaceQuery);

      hub.trigger('RunCreated', run({ workspaceId: 'w9' }), null);

      expect(query.getEntity('w9')).toEqual({
        id: 'w9',
        runs: [
          { ...run({ workspaceId: 'w9' }), displayStatus: RunStatus.Planning },
        ],
      });
    });

    /**
     * Verifies: a run event for a workspace that arrived over the hub without runs throws in the handler and the run is lost.
     * Interacts with: WorkspaceService.updated and runUpdated, WorkspaceQuery (real).
     * Data: WorkspaceCreated('w1') with the API payload (no runs), then RunCreated for 'w1'.
     */
    it('drops a run for a workspace created over the hub (no runs array)', async () => {
      const { hub } = await connected();
      const query = TestBed.inject(WorkspaceQuery);
      hub.trigger('WorkspaceCreated', apiWorkspace(), []);

      // Same case as 'throws for a workspace stored without a runs array' in workspace.service.spec.ts.
      expect(() => hub.trigger('RunCreated', run(), null)).toThrow(TypeError);
      expect(query.getEntity('w1').runs).toBeUndefined();
    });
  });

  describe('design, variable, module and VLAN events', () => {
    interface EntityCase<E extends { id?: string }> {
      prefix: string;
      query: () => {
        getEntity(id: string): E | undefined;
        hasEntity(id: string): boolean;
      };
      entity: E;
      /** A change to a property the update names in modifiedProperties. */
      change: Partial<E>;
      /** The PascalCase name caster.api puts in modifiedProperties. */
      changedProperty: string;
      /** A change to a property the update does NOT name. */
      unlisted: Partial<E>;
    }

    function describeEntityEvents<E extends { id?: string }>(c: EntityCase<E>) {
      describe(c.prefix, () => {
        const id = c.entity.id;
        const payload = { ...c.entity, ...c.unlisted, ...c.change };

        /**
         * Verifies: <Entity>Created adds the entity to its Akita store.
         * Interacts with: the entity's state service add(), its real store and query.
         * Data: the fixture entity for this row.
         */
        it(`${c.prefix}Created adds the entity`, async () => {
          const { hub } = await connected();

          hub.trigger(`${c.prefix}Created`, c.entity);

          expect(c.query().getEntity(id)).toEqual(c.entity);
        });

        /**
         * Verifies: <Entity>Updated applies only the properties named in modifiedProperties, camelCasing the API's PascalCase names.
         * Interacts with: getModified/titleToCamelCase, the state service update(), the real store and query.
         * Data: a payload that changes one listed and one unlisted property.
         */
        it(`${c.prefix}Updated applies only the modified properties`, async () => {
          const { hub } = await connected();
          hub.trigger(`${c.prefix}Created`, c.entity);

          hub.trigger(`${c.prefix}Updated`, payload, [c.changedProperty]);

          expect(c.query().getEntity(id)).toEqual({ ...c.entity, ...c.change });
        });

        /**
         * Verifies: <Entity>Updated with modifiedProperties null applies the whole payload.
         * Interacts with: getModified, the state service update(), the real store and query.
         * Data: the same payload with modifiedProperties null.
         */
        it(`${c.prefix}Updated without modifiedProperties applies the whole payload`, async () => {
          const { hub } = await connected();
          hub.trigger(`${c.prefix}Created`, c.entity);

          hub.trigger(`${c.prefix}Updated`, payload, null);

          expect(c.query().getEntity(id)).toEqual(payload);
        });

        /**
         * Verifies: <Entity>Deleted removes the entity.
         * Interacts with: the state service remove(), the real store and query.
         * Data: the fixture entity, created first.
         */
        it(`${c.prefix}Deleted removes the entity`, async () => {
          const { hub } = await connected();
          hub.trigger(`${c.prefix}Created`, c.entity);

          hub.trigger(`${c.prefix}Deleted`, id);

          expect(c.query().hasEntity(id)).toBe(false);
        });
      });
    }

    describeEntityEvents<Design>({
      prefix: 'Design',
      query: () => TestBed.inject(DesignQuery),
      entity: { id: 'de1', name: 'Web tier', directoryId: 'd1', enabled: true },
      change: { enabled: false },
      changedProperty: 'Enabled',
      unlisted: { name: 'Not listed' },
    });

    describeEntityEvents<Variable>({
      prefix: 'Variable',
      query: () => TestBed.inject(VariablesQuery),
      entity: {
        id: 'v1',
        designId: 'de1',
        name: 'region',
        type: VariableType.String,
        defaultValue: 'us-east-1',
      },
      change: { defaultValue: 'eu-west-1' },
      changedProperty: 'DefaultValue',
      unlisted: { name: 'Not listed' },
    });

    describeEntityEvents<DesignModule>({
      prefix: 'DesignModule',
      query: () => TestBed.inject(DesignModuleQuery),
      entity: {
        id: 'dm1',
        designId: 'de1',
        moduleId: 'm1',
        name: 'vpc',
        moduleVersion: '1.0.0',
        enabled: true,
      },
      change: { moduleVersion: '2.0.0' },
      changedProperty: 'ModuleVersion',
      unlisted: { name: 'Not listed' },
    });

    describeEntityEvents<Pool>({
      prefix: 'Pool',
      query: () => TestBed.inject(PoolQuery),
      entity: { id: 'po1', name: 'Default pool', isDefault: true },
      change: { isDefault: false },
      changedProperty: 'IsDefault',
      unlisted: { name: 'Not listed' },
    });

    describeEntityEvents<Partition>({
      prefix: 'Partition',
      query: () => TestBed.inject(PartitionQuery),
      entity: { id: 'pa1', poolId: 'po1', name: 'Range A', isDefault: false },
      change: { name: 'Range B' },
      changedProperty: 'Name',
      unlisted: { isDefault: true },
    });

    describeEntityEvents<Vlan>({
      prefix: 'Vlan',
      query: () => TestBed.inject(VlanQuery),
      entity: {
        id: 'vl1',
        poolId: 'po1',
        partitionId: 'pa1',
        vlanId: 100,
        inUse: false,
        tag: 'blue',
        reserved: false,
      },
      change: { inUse: true },
      changedProperty: 'InUse',
      unlisted: { tag: 'Not listed' },
    });

    /**
     * Verifies: an update for an entity the store doesn't hold is ignored (Akita update is a no-op for unknown ids).
     * Interacts with: DesignService.update, DesignQuery (real).
     * Data: DesignUpdated for 'unknown' with modifiedProperties ['Name'].
     */
    it('ignores an update for an entity that is not in the store', async () => {
      const { hub } = await connected();

      hub.trigger('DesignUpdated', { id: 'unknown', name: 'X' }, ['Name']);

      expect(TestBed.inject(DesignQuery).hasEntity('unknown')).toBe(false);
    });

    /**
     * Verifies: a single-character property name is not camelCased, so it doesn't match the entity's property.
     * Interacts with: getModified/titleToCamelCase through DesignUpdated, DesignQuery (real).
     * Data: modifiedProperties ['N'] on a payload whose `n` property changed.
     */
    it('does not camelCase single-character property names', async () => {
      const { hub } = await connected();
      const design: Design & { n?: string } = {
        id: 'de1',
        name: 'Web',
        n: 'old',
      };
      hub.trigger('DesignCreated', design);

      hub.trigger('DesignUpdated', { ...design, n: 'new' }, ['N']);

      // NOTE: titleToCamelCase skips strings of length 1, so 'N' stays 'N' and
      // an `N: undefined` key is merged instead. No caster model has a
      // one-letter property today.
      expect(TestBed.inject(DesignQuery).getEntity('de1')).toEqual({
        ...design,
        N: undefined,
      });
    });
  });

  describe('role and membership events', () => {
    const role: SystemRole = {
      id: 'ro1',
      name: 'Observer',
      allPermissions: false,
      immutable: false,
      permissions: [],
    };

    /**
     * Verifies: RoleCreated adds the role, RoleUpdated applies only the listed properties, and RoleDeleted removes it.
     * Interacts with: RoleService.upsert/remove (real), RoleService.roles$.
     * Data: role 'ro1' created, renamed with modifiedProperties ['Name'] (immutable changed too but unlisted), then deleted.
     */
    it('Role events add, update and remove roles', async () => {
      const { hub } = await connected();
      const roles = TestBed.inject(RoleService);

      hub.trigger('RoleCreated', role, null);
      expect(await firstValueFrom(roles.roles$)).toEqual([role]);

      hub.trigger(
        'RoleUpdated',
        { ...role, name: 'Auditor', immutable: true },
        ['Name'],
      );
      expect(await firstValueFrom(roles.roles$)).toEqual([
        { ...role, name: 'Auditor' },
      ]);

      hub.trigger('RoleDeleted', 'ro1');
      expect(await firstValueFrom(roles.roles$)).toEqual([]);
    });

    /**
     * Verifies: RoleUpdated mutates the stored role object and re-emits the same array instance.
     * Interacts with: RoleService.upsert (real), RoleService.rolesSubject.
     * Data: rolesSubject seeded with 'ro1'; RoleUpdated renames it.
     */
    it('RoleUpdated mutates the existing role and array in place', async () => {
      const { hub } = await connected();
      const roles = TestBed.inject(RoleService);
      const seeded = [{ ...role }];
      roles.rolesSubject.next(seeded);

      hub.trigger('RoleUpdated', { ...role, name: 'Auditor' }, ['Name']);

      // RoleService (and both membership services) upsert by mutating the
      // stored object and re-emitting the same array; a consumer that
      // compared by reference (OnPush inputs, distinctUntilChanged) would not
      // see the change.
      expect(roles.rolesSubject.getValue()).toBe(seeded);
      expect(seeded[0].name).toBe('Auditor');
    });

    /**
     * Verifies: RoleUpdated for a role that isn't loaded inserts a partial role containing only the listed properties.
     * Interacts with: RoleService.upsert (real).
     * Data: empty role list; RoleUpdated for 'ro9' with modifiedProperties ['Name'].
     */
    it('RoleUpdated for an unknown role inserts a partial role', async () => {
      const { hub } = await connected();
      const roles = TestBed.inject(RoleService);

      hub.trigger('RoleUpdated', { ...role, id: 'ro9', name: 'New' }, ['Name']);

      // NOTE: unlike the Akita-backed entities (where an unknown id is
      // ignored), the subject-backed services insert `{ name, id }`, without
      // permissions or flags.
      expect(roles.rolesSubject.getValue()).toEqual([
        { id: 'ro9', name: 'New' },
      ]);
    });

    /**
     * Verifies: GroupMembership events add, update (listed properties only) and remove memberships, visible through selectMemberships.
     * Interacts with: GroupMembershipService.upsert/remove/selectMemberships (real).
     * Data: membership 'gm1' in group 'g1' promoted to Manager with modifiedProperties ['Role'], then deleted.
     */
    it('GroupMembership events add, update and remove memberships', async () => {
      const { hub } = await connected();
      const service = TestBed.inject(GroupMembershipService);
      const membership: GroupMembership = {
        id: 'gm1',
        groupId: 'g1',
        userId: 'u1',
        role: GroupMembershipRole.Member,
      };

      hub.trigger('GroupMembershipCreated', membership, null);
      expect(await firstValueFrom(service.selectMemberships('g1'))).toEqual([
        membership,
      ]);

      hub.trigger(
        'GroupMembershipUpdated',
        {
          ...membership,
          role: GroupMembershipRole.Manager,
          userId: 'unlisted',
        },
        ['Role'],
      );
      expect(await firstValueFrom(service.selectMemberships('g1'))).toEqual([
        { ...membership, role: GroupMembershipRole.Manager },
      ]);

      hub.trigger('GroupMembershipDeleted', 'gm1');
      expect(await firstValueFrom(service.groupMemberships$)).toEqual([]);
    });

    /**
     * Verifies: ProjectMembership events add, update (listed properties only) and remove memberships.
     * Interacts with: ProjectMembershipService.upsert/remove (real), projectMemberships$.
     * Data: membership 'pm1' given role 'role-2' with modifiedProperties ['RoleId'], then deleted.
     */
    it('ProjectMembership events add, update and remove memberships', async () => {
      const { hub } = await connected();
      const service = TestBed.inject(ProjectMembershipService);
      const membership: ProjectMembership = {
        id: 'pm1',
        projectId: 'p1',
        userId: 'u1',
        roleId: 'role-1',
      };

      hub.trigger('ProjectMembershipCreated', membership, null);
      expect(await firstValueFrom(service.projectMemberships$)).toEqual([
        membership,
      ]);

      hub.trigger(
        'ProjectMembershipUpdated',
        { ...membership, roleId: 'role-2', userId: 'unlisted' },
        ['RoleId'],
      );
      expect(await firstValueFrom(service.projectMemberships$)).toEqual([
        { ...membership, roleId: 'role-2' },
      ]);

      hub.trigger('ProjectMembershipDeleted', 'pm1');
      expect(await firstValueFrom(service.projectMemberships$)).toEqual([]);
    });
  });
});
