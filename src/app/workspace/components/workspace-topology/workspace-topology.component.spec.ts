// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
  onTestFinished,
  vi,
} from 'vitest';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ComnAuthQuery, CrucibleDialogService } from '@cmusei/crucible-common';
import cytoscape, { type Core } from 'cytoscape';
import {
  EditWorkspaceTopologyLayoutCommand,
  Run,
  WorkspaceTopology,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { WorkspaceStore } from '../../state/workspace.store';
import { WorkspaceTopologyComponent } from './workspace-topology.component';

const WEB = 'module.web.vsphere_virtual_machine.vm';
const DB = 'vsphere_virtual_machine.db';
const LAN = 'vsphere_distributed_port_group.lan';
const UPLINK = 'data.vsphere_network.uplink';

/** A web server with a Player record, a database the apply never made, a LAN and an uplink. */
function topology(
  overrides: Partial<WorkspaceTopology> = {},
): WorkspaceTopology {
  return {
    workspaceId: 'w1',
    source: 'Plan',
    runId: 'r1',
    createdAt: '2026-10-20T12:00:00Z',
    nodes: [
      {
        id: WEB,
        kind: 'Machine',
        label: 'vm',
        type: 'vsphere_virtual_machine',
        module: 'web',
        action: 'no-op',
        properties: { cpus: '2' },
        console: {
          address: 'crucible_player_virtual_machine.web',
          action: 'update',
          name: 'Web 01',
          url: 'https://player.example/console/1',
          teamIds: ['t1', 't2'],
          teams: [
            { id: 't1', name: 'Blue' },
            { id: 't2', name: 'Red', variable: 'red_team' },
          ],
          match: 'Name',
        },
      },
      {
        id: DB,
        kind: 'Machine',
        label: 'db',
        type: 'vsphere_virtual_machine',
        action: 'create',
        notCreated: true,
      },
      { id: LAN, kind: 'Network', label: 'lan', action: 'create' },
      { id: UPLINK, kind: 'Network', label: 'uplink', external: true },
    ],
    edges: [
      { from: WEB, to: LAN, nic: 1 },
      { from: WEB, to: UPLINK, nic: 0 },
      { from: DB, to: LAN, nic: 0 },
    ],
    layout: {},
    ...overrides,
  };
}

/**
 * jsdom has no canvas (see jsdom-canvas.ts), and cytoscape's renderer throws
 * without a 2D context. Drawing is never asserted on, so a context that
 * accepts every call and measures text by its length is enough.
 */
function fakeCanvasContext(canvas: HTMLCanvasElement) {
  const noop = () => {};
  const target: Record<string | symbol, unknown> = {
    canvas,
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getLineDash: () => [],
    isPointInPath: () => false,
  };
  return new Proxy(target, {
    get: (t, prop) => (prop in t ? t[prop] : noop),
    set: (t, prop, value) => {
      t[prop] = value;
      return true;
    },
  });
}

const getContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  localStorage.clear();
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    return fakeCanvasContext(this);
  } as unknown as typeof getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
  vi.unstubAllGlobals();
});

/**
 * jsdom has neither ClipboardItem nor a writable clipboard. Call it after
 * userEvent.setup(), which puts its own clipboard on the navigator.
 */
function stubClipboard(write: () => Promise<void>) {
  vi.stubGlobal(
    'ClipboardItem',
    class {
      constructor(readonly items: Record<string, unknown>) {}
    },
  );
  const spy = vi.fn(write);
  Object.defineProperty(navigator, 'clipboard', {
    value: { write: spy },
    configurable: true,
  });
  return spy;
}

interface RenderOptions {
  canEdit?: boolean;
  runs?: Run[];
  topology$?: Observable<WorkspaceTopology>;
  save$?: Observable<unknown>;
  confirmAnswer?: boolean;
  userTheme$?: Observable<string>;
}

async function renderTopology(
  shown: WorkspaceTopology,
  options: RenderOptions = {},
) {
  const {
    canEdit = true,
    runs = [{ id: 'r1', status: 'Planned' }],
    confirmAnswer,
  } = options;
  const workspacesApi = {
    getWorkspaceTopology: vi.fn(() => options.topology$ ?? of(shown)),
    editWorkspaceTopologyLayout: vi.fn(
      (_id: string, _command: EditWorkspaceTopologyLayoutCommand) =>
        (options.save$ ?? of(null)) as Observable<any>,
    ),
  } satisfies ApiStub<WorkspacesService>;
  const confirm = vi.fn(
    () => dialogRefStub<unknown, boolean>(confirmAnswer).dialogRef,
  );
  const view = await renderComponent(WorkspaceTopologyComponent, {
    providers: [
      { provide: WorkspacesService, useValue: workspacesApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
      {
        provide: ComnAuthQuery,
        useValue: {
          userTheme$: options.userTheme$ ?? of('light-theme'),
          isLoggedIn$: of(true),
        },
      },
    ],
    inputs: { workspaceId: 'w1', canEdit },
    configureTestBed: (testBed) =>
      testBed.inject(WorkspaceStore).set([{ id: 'w1', name: 'dev', runs }]),
  });
  const component = view.fixture.componentInstance;
  // The graph is private; the specs drive it as a reader's clicks and drags would.
  const graph = () => (component as unknown as { cy: Core }).cy;
  if (shown.nodes?.length && !options.topology$) {
    await waitFor(() => expect(graph()).toBeTruthy());
  }
  /** What the reader would do by clicking the node on the canvas. */
  const tap = (id: string) => {
    graph().getElementById(id).emit('tap');
    view.fixture.detectChanges();
  };
  return {
    ...view,
    component,
    graph,
    tap,
    workspacesApi,
    confirm,
    user: userEvent.setup(),
  };
}

describe('WorkspaceTopologyComponent', () => {
  describe('without a drawing', () => {
    /**
     * Verifies: a workspace that has never planned asks for a plan.
     * Interacts with: WorkspacesService.getWorkspaceTopology (stub).
     * Data: no run, no nodes.
     */
    it('asks for a plan before there is one', async () => {
      await renderTopology({ workspaceId: 'w1', nodes: [] });

      expect(
        screen.getByText('Run a plan to see the topology.'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Fit to view' }),
      ).not.toBeInTheDocument();
    });

    /**
     * Verifies: an empty plan and an empty state each say which one had nothing to draw.
     * Interacts with: WorkspacesService.getWorkspaceTopology (stub).
     * Data: run r1 with no nodes, from the plan and from the state.
     */
    it.each([
      ['Plan', 'The latest plan has no machines or networks'],
      ['State', "The workspace's state has no machines or networks"],
    ] as const)('says the %s has nothing to draw', async (source, message) => {
      await renderTopology(topology({ source, nodes: [], edges: [] }));

      expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    });

    /**
     * Verifies: a failed fetch shows the API's reason instead of a spinner.
     * Interacts with: WorkspacesService.getWorkspaceTopology (stub, errors).
     * Data: a problem details error titled "Workspace not found".
     */
    it('says why the topology is unavailable', async () => {
      await renderTopology(topology(), {
        topology$: throwError(() => ({
          error: { title: 'Workspace not found' },
        })),
      });

      expect(
        screen.getByText('Topology unavailable: Workspace not found'),
      ).toBeInTheDocument();
    });
  });

  describe('the plan', () => {
    /**
     * Verifies: a pending plan names its time and lists the outline colours.
     * Interacts with: the bar and legend.
     * Data: run r1 Planned.
     */
    it('outlines what a pending plan changes', async () => {
      await renderTopology(topology());

      expect(screen.getByText(/Plan from\s+2026-10-20/)).toBeInTheDocument();
      ['create', 'update', 'replace', 'delete', 'external'].forEach((key) =>
        expect(screen.getByText(key)).toBeInTheDocument(),
      );
      expect(screen.queryByText('not created')).not.toBeInTheDocument();
    });

    /**
     * Verifies: once the plan is applied the API draws the state; the outlines go, and what the apply did not create is called out.
     * Interacts with: the bar and legend.
     * Data: source State; db notCreated.
     */
    it('drops the outlines once the plan is applied', async () => {
      const { graph } = await renderTopology(topology({ source: 'State' }), {
        runs: [{ id: 'r1', status: 'Applied' }],
      });

      expect(screen.queryByText('create')).not.toBeInTheDocument();
      expect(screen.getByText('not created')).toBeInTheDocument();
      expect(graph().getElementById(LAN).data('action')).toBe('');
    });

    /**
     * Verifies: a plan still drawn after its run was applied (a state error) shows the run's status and no outlines.
     * Interacts with: the real WorkspaceStore, WorkspacesService.getWorkspaceTopology (stub).
     * Data: run r1 Planned, then Applied - State Error, the plan refetched unchanged.
     */
    it('drops the outlines when the run is applied before the state is drawn', async () => {
      const { graph, workspacesApi, fixture } =
        await renderTopology(topology());
      expect(screen.getByText('create')).toBeInTheDocument();

      fixture.debugElement.injector.get(WorkspaceStore).update('w1', {
        runs: [{ id: 'r1', status: 'Applied - State Error' }],
      });

      await waitFor(() =>
        expect(workspacesApi.getWorkspaceTopology).toHaveBeenCalledTimes(2),
      );
      await waitFor(() =>
        expect(screen.getByText(/· Applied - State Error/)).toBeInTheDocument(),
      );
      expect(screen.queryByText('create')).not.toBeInTheDocument();
      expect(graph().getElementById(LAN).data('action')).toBe('');
    });

    /**
     * Verifies: a destroy plan is named as one.
     * Interacts with: the bar.
     * Data: isDestroy.
     */
    it('names a destroy plan', async () => {
      await renderTopology(topology({ isDestroy: true }));

      expect(screen.getByText(/Destroy plan from/)).toBeInTheDocument();
    });

    /**
     * Verifies: a run changing status refetches the topology and redraws it in place.
     * Interacts with: the real WorkspaceStore, WorkspacesService.getWorkspaceTopology (stub).
     * Data: run r1 Planned, then Applied, with the state now drawn.
     */
    it('refetches when a run changes status', async () => {
      const { graph, workspacesApi, fixture } =
        await renderTopology(topology());
      const first = graph();
      workspacesApi.getWorkspaceTopology.mockReturnValue(
        of(
          topology({
            source: 'State',
            nodes: topology().nodes.slice(2),
            edges: [],
          }),
        ),
      );

      fixture.debugElement.injector
        .get(WorkspaceStore)
        .update('w1', { runs: [{ id: 'r1', status: 'Applied' }] });

      await waitFor(() =>
        expect(workspacesApi.getWorkspaceTopology).toHaveBeenCalledTimes(2),
      );
      await waitFor(() => expect(graph().nodes('[kind]').length).toBe(2));
      expect(graph()).toBe(first);
    });

    /**
     * Verifies: a refetch that comes back empty removes the graph.
     * Interacts with: the real WorkspaceStore, WorkspacesService.getWorkspaceTopology (stub).
     * Data: a drawn plan, then an empty one.
     */
    it('clears the graph when the topology empties', async () => {
      const { graph, workspacesApi, fixture } =
        await renderTopology(topology());
      workspacesApi.getWorkspaceTopology.mockReturnValue(
        of(topology({ nodes: [], edges: [] })),
      );

      fixture.debugElement.injector
        .get(WorkspaceStore)
        .update('w1', { runs: [{ id: 'r1', status: 'ApplyQueued' }] });

      await waitFor(() => expect(graph()).toBeNull());
      expect(
        screen.getByText(/The latest plan has no machines/),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: switching theme restyles the graph, which cannot read CSS variables itself.
     * Interacts with: ComnAuthQuery.userTheme$ (stub).
     * Data: light, then dark.
     */
    it('restyles the graph when the theme flips', async () => {
      const theme$ = new Subject<string>();
      const { graph } = await renderTopology(topology(), {
        userTheme$: theme$,
      });
      const style = vi.spyOn(graph(), 'style');

      theme$.next('light-theme');
      theme$.next('dark-theme');

      await waitFor(() =>
        expect(style).toHaveBeenCalledWith(expect.any(Array)),
      );
    });
  });

  describe('the graph', () => {
    /**
     * Verifies: a module with several resources is boxed, a lone one is not, and labels are the Player names.
     * Interacts with: the cytoscape elements.
     * Data: module web with one machine; module app with two.
     */
    it('boxes only modules that group several resources', async () => {
      const shown = topology();
      shown.nodes.push(
        { id: 'module.app.a', kind: 'Machine', label: 'a', module: 'app' },
        { id: 'module.app.b', kind: 'Machine', label: 'b', module: 'app' },
      );
      const { graph } = await renderTopology(shown);

      expect(graph().getElementById('module:app').nonempty()).toBe(true);
      expect(graph().getElementById('module:web').empty()).toBe(true);
      expect(graph().getElementById('module.app.a').data('parent')).toBe(
        'module:app',
      );
      expect(graph().getElementById(WEB).data('label')).toBe('Web 01');
      expect(graph().getElementById(WEB).data('action')).toBe('update');
      expect(graph().getElementById(UPLINK).hasClass('external')).toBe(true);
    });

    /**
     * Verifies: the tree hangs everything off the uplink, one row per hop.
     * Interacts with: the tree layout.
     * Data: uplink -> web -> lan -> db, nothing placed.
     */
    it('lays an unarranged topology out as a tree from the uplink', async () => {
      const { graph } = await renderTopology(topology());
      const y = (id: string) => graph().getElementById(id).position().y;

      expect(y(UPLINK)).toBe(0);
      expect(y(WEB)).toBeGreaterThan(y(UPLINK));
      expect(y(LAN)).toBeGreaterThan(y(WEB));
      expect(y(DB)).toBeGreaterThan(y(LAN));
    });

    /**
     * Verifies: a fully arranged topology is drawn where it was saved, and switching layouts keeps each one's own positions and the choice.
     * Interacts with: the layout toggle, localStorage.
     * Data: every node saved at distinct tree and grouped positions.
     */
    it('draws each layout where it was saved', async () => {
      const ids = [WEB, DB, LAN, UPLINK];
      const layout = Object.fromEntries(
        ids.map((id, i) => [
          id,
          { treeX: i * 100, treeY: 50, x: i * 10, y: 5 },
        ]),
      );
      const { graph, user } = await renderTopology(topology({ layout }));

      expect(graph().getElementById(LAN).position()).toEqual({ x: 200, y: 50 });

      await user.click(
        screen.getByRole('button', { name: 'Switch to grouped layout' }),
      );

      expect(graph().getElementById(LAN).position()).toEqual({ x: 20, y: 5 });
      expect(localStorage.getItem('caster.topology.layoutStyle')).toBe('force');
      expect(
        screen.getByRole('button', { name: 'Switch to tree layout' }),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: the grouped layout places what nobody moved and keeps what someone did where they put it.
     * Interacts with: the grouped (cose) layout, chosen from localStorage.
     * Data: only the lan saved, at (300, 400).
     */
    it('lays out the rest around what was placed', async () => {
      localStorage.setItem('caster.topology.layoutStyle', 'force');
      // cose sizes itself from the container, which jsdom never lays out.
      const core = Object.getPrototypeOf(cytoscape({ headless: true })) as Core;
      vi.spyOn(core, 'width').mockReturnValue(800);
      vi.spyOn(core, 'height').mockReturnValue(600);
      const { graph } = await renderTopology(
        topology({ layout: { [LAN]: { x: 300, y: 400 } } }),
      );

      expect(graph().getElementById(LAN).position()).toEqual({
        x: 300,
        y: 400,
      });
      expect(graph().getElementById(LAN).locked()).toBe(false);
    });
  });

  describe('the details', () => {
    /**
     * Verifies: a machine's details name its Player record, its resources, what changes, its networks and its teams.
     * Interacts with: a tap on the machine.
     * Data: web, its Player record updated alone, matched by name, on two teams.
     */
    it('describes a machine', async () => {
      const { tap, container } = await renderTopology(topology());

      tap(WEB);

      const details = within(
        container.querySelector('.details') as HTMLElement,
      );
      expect(details.getByText('Web 01')).toBeInTheDocument();
      expect(details.getByText(WEB)).toBeInTheDocument();
      expect(details.getByText('vm')).toBeInTheDocument();
      expect(
        details.getByText('crucible_player_virtual_machine'),
      ).toBeInTheDocument();
      expect(
        details.getByText('crucible_player_virtual_machine only'),
      ).toBeInTheDocument();
      expect(details.getByText('2')).toBeInTheDocument();
      expect(details.getByText('nic0').nextElementSibling).toHaveTextContent(
        'uplink',
      );
      expect(details.getByText('nic1').nextElementSibling).toHaveTextContent(
        'lan',
      );
      expect(details.getByText('Teams')).toBeInTheDocument();
      expect(details.getByText('var.red_team')).toBeInTheDocument();
      expect(
        details.getByText('Matched to its Player record by name only'),
      ).toBeInTheDocument();
      expect(
        details.getByRole('link', { name: 'Open console' }),
      ).toHaveAttribute('href', 'https://player.example/console/1');
    });

    /**
     * Verifies: a machine the apply failed to create says so, and a network lists its machines by Player name.
     * Interacts with: taps on db, then on lan.
     * Data: db notCreated; lan carrying web and db.
     */
    it('describes an uncreated machine and a network', async () => {
      const { tap, container } = await renderTopology(topology());
      const details = () =>
        within(container.querySelector('.details') as HTMLElement);

      tap(DB);
      expect(
        details().getByText(/Not created: the apply failed/),
      ).toBeInTheDocument();
      expect(details().getByText('create')).toBeInTheDocument();

      tap(LAN);
      const machines = details().getByText('Machines').nextElementSibling;
      expect(machines).toHaveTextContent('Web 01');
      expect(machines).toHaveTextContent('db');
    });

    /**
     * Verifies: an external network says it is not managed here, and tapping the background closes the details.
     * Interacts with: a tap on the uplink, then on the empty canvas.
     * Data: uplink external.
     */
    it('closes the details from the background', async () => {
      const { tap, graph, fixture, container } =
        await renderTopology(topology());

      tap(UPLINK);
      expect(
        screen.getByText('Not managed by this workspace'),
      ).toBeInTheDocument();

      graph().emit('tap');
      fixture.detectChanges();
      expect(container.querySelector('.details')).toBeNull();
    });

    /**
     * Verifies: a team-less console says it is not in Player, and one with unknown teams says they come after apply.
     * Interacts with: taps on two machines.
     * Data: one console with no teams; one with teamsUnknown and no url.
     */
    it('says when the teams are not known yet', async () => {
      const shown = topology();
      shown.nodes.push(
        {
          id: 'a',
          kind: 'Machine',
          label: 'a',
          console: { address: 'p.a', teamIds: [] },
        },
        {
          id: 'b',
          kind: 'Machine',
          label: 'b',
          console: { address: 'p.b', teamsUnknown: true },
        },
      );
      const { tap } = await renderTopology(shown);

      tap('a');
      expect(
        screen.getByText('None: not registered in Player'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Console')).not.toBeInTheDocument();

      tap('b');
      expect(screen.getByText('Known after apply')).toBeInTheDocument();
      expect(screen.getByText('Available after apply')).toBeInTheDocument();
    });
  });

  describe('saving the layout', () => {
    /**
     * Verifies: dragging a module box saves where each machine in it ended up.
     * Interacts with: a dragfree on the box, WorkspacesService.editWorkspaceTopologyLayout (stub).
     * Data: module app holding a and b.
     */
    it('saves where dragged nodes were left', async () => {
      const shown = topology();
      shown.nodes.push(
        { id: 'module.app.a', kind: 'Machine', label: 'a', module: 'app' },
        { id: 'module.app.b', kind: 'Machine', label: 'b', module: 'app' },
      );
      const { graph, workspacesApi } = await renderTopology(shown);
      graph().getElementById('module.app.a').position({ x: 10.4, y: 20.6 });

      graph().getElementById('module:app').emit('dragfree');

      await waitFor(() =>
        expect(workspacesApi.editWorkspaceTopologyLayout).toHaveBeenCalled(),
      );
      const { nodes } =
        workspacesApi.editWorkspaceTopologyLayout.mock.calls[0][1];
      expect(Object.keys(nodes).sort()).toEqual([
        'module.app.a',
        'module.app.b',
      ]);
      expect(nodes['module.app.a']).toMatchObject({ treeX: 10, treeY: 21 });
      expect(
        screen.getByRole('button', { name: 'Reset tree layout' }),
      ).toBeEnabled();
    });

    /**
     * Verifies: a reader who may not edit can drag nodes about, but nothing is saved and there is no reset.
     * Interacts with: a dragfree, WorkspacesService.editWorkspaceTopologyLayout (stub).
     * Data: canEdit false.
     */
    it('saves nothing for a reader who may not edit', async () => {
      const { graph, workspacesApi } = await renderTopology(topology(), {
        canEdit: false,
      });

      graph().getElementById(DB).emit('dragfree');
      await new Promise((resolve) => setTimeout(resolve, 450));

      expect(workspacesApi.editWorkspaceTopologyLayout).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('button', { name: /Reset/ }),
      ).not.toBeInTheDocument();
    });

    /**
     * Verifies: a drag still waiting to save is saved when the view closes.
     * Interacts with: a dragfree, then destroy.
     * Data: db dragged.
     */
    it('saves a pending drag on leaving', async () => {
      const { graph, workspacesApi, fixture } =
        await renderTopology(topology());

      graph().getElementById(DB).emit('dragfree');
      fixture.destroy();

      expect(workspacesApi.editWorkspaceTopologyLayout).toHaveBeenCalledTimes(
        1,
      );
    });

    /**
     * Verifies: picking a role saves it for the machine and redraws its icon.
     * Interacts with: the Role select, WorkspacesService.editWorkspaceTopologyLayout (stub).
     * Data: web given Server, then None.
     */
    it('saves a machine role', async () => {
      const { tap, graph, user, workspacesApi } =
        await renderTopology(topology());
      tap(WEB);

      await user.click(screen.getByRole('combobox', { name: 'Role' }));
      await user.click(await screen.findByRole('option', { name: 'Server' }));

      expect(
        workspacesApi.editWorkspaceTopologyLayout,
      ).toHaveBeenLastCalledWith('w1', {
        nodes: { [WEB]: { role: 'Server' } },
      });
      expect(graph().getElementById(WEB).data('role')).toBe('Server');

      await user.click(screen.getByRole('combobox', { name: 'Role' }));
      await user.click(await screen.findByRole('option', { name: 'None' }));

      expect(
        workspacesApi.editWorkspaceTopologyLayout,
      ).toHaveBeenLastCalledWith('w1', {
        nodes: { [WEB]: null },
      });
    });

    /**
     * Verifies: a failed save says why.
     * Interacts with: the Role select, WorkspacesService.editWorkspaceTopologyLayout (stub, errors), the snack bar.
     * Data: an error with message "Forbidden".
     */
    it('says when the layout could not be saved', async () => {
      const { tap, user } = await renderTopology(topology(), {
        save$: throwError(() => new Error('Forbidden')),
      });
      tap(WEB);

      await user.click(screen.getByRole('combobox', { name: 'Role' }));
      await user.click(await screen.findByRole('option', { name: 'Router' }));

      expect(
        await screen.findByText('Could not save the layout: Forbidden'),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: a confirmed reset forgets this layout's positions for everyone and keeps roles and the other layout.
     * Interacts with: Reset tree layout, CrucibleDialogService.confirm (stub, true), WorkspacesService.editWorkspaceTopologyLayout (stub).
     * Data: lan placed in both layouts; web placed in the tree with role Router.
     */
    it('resets a layout after confirming', async () => {
      const { user, workspacesApi, confirm } = await renderTopology(
        topology({
          layout: {
            [LAN]: { treeX: 1, treeY: 2, x: 3, y: 4 },
            [WEB]: { treeX: 5, treeY: 6, role: 'Router' },
          },
        }),
        { confirmAnswer: true },
      );

      await user.click(
        screen.getByRole('button', { name: 'Reset tree layout' }),
      );

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Reset Layout' }),
      );
      expect(workspacesApi.editWorkspaceTopologyLayout).toHaveBeenCalledWith(
        'w1',
        {
          nodes: {
            [LAN]: { treeX: null, treeY: null, x: 3, y: 4 },
            [WEB]: { treeX: null, treeY: null, role: 'Router' },
          },
        },
      );
      expect(
        screen.getByRole('button', { name: 'Reset tree layout' }),
      ).toBeDisabled();
    });

    /**
     * Verifies: a cancelled reset changes nothing.
     * Interacts with: Reset tree layout, CrucibleDialogService.confirm (stub, false).
     * Data: lan placed in the tree.
     */
    it('keeps the layout when the reset is cancelled', async () => {
      const { user, workspacesApi } = await renderTopology(
        topology({ layout: { [LAN]: { treeX: 1, treeY: 2 } } }),
        { confirmAnswer: false },
      );

      await user.click(
        screen.getByRole('button', { name: 'Reset tree layout' }),
      );

      expect(workspacesApi.editWorkspaceTopologyLayout).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Reset tree layout' }),
      ).toBeEnabled();
    });
  });

  describe('the toolbar', () => {
    /**
     * Verifies: Copy image puts a PNG of the whole graph on the clipboard and says so.
     * Interacts with: Copy image, navigator.clipboard (fake), the snack bar.
     * Data: a PNG blob.
     */
    it('copies the graph as an image', async () => {
      const { graph, user } = await renderTopology(topology());
      const write = stubClipboard(() => Promise.resolve());
      const png = vi
        .spyOn(graph(), 'png')
        .mockReturnValue(Promise.resolve(new Blob()) as any);

      await user.click(screen.getByRole('button', { name: 'Copy image' }));

      expect(png).toHaveBeenCalledWith(
        expect.objectContaining({ full: true, output: 'blob-promise' }),
      );
      expect(write).toHaveBeenCalledWith([
        expect.objectContaining({ items: expect.any(Object) }),
      ]);
      expect(
        await screen.findByText('Copied to clipboard'),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: a refused clipboard write says why.
     * Interacts with: Copy image, navigator.clipboard (fake, rejects).
     * Data: "Write permission denied".
     */
    it('says when the image could not be copied', async () => {
      const { graph, user } = await renderTopology(topology());
      stubClipboard(() => Promise.reject(new Error('Write permission denied')));
      vi.spyOn(graph(), 'png').mockReturnValue(
        Promise.resolve(new Blob()) as any,
      );

      await user.click(screen.getByRole('button', { name: 'Copy image' }));

      expect(
        await screen.findByText(
          'Could not copy the image: Write permission denied',
        ),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: Download image saves a PNG named after the workspace.
     * Interacts with: Download image, URL.createObjectURL (fake), the link it clicks.
     * Data: workspace dev.
     */
    it('downloads the graph as an image', async () => {
      // jsdom has neither. The revoke runs a second after the test, so it stays a no-op.
      const createObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:topology');
      URL.revokeObjectURL ??= () => {};
      onTestFinished(() => {
        URL.createObjectURL = createObjectURL;
      });
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          expect(this.download).toBe('dev-topology.png');
          expect(this.href).toBe('blob:topology');
        });
      const { graph, user } = await renderTopology(topology());
      vi.spyOn(graph(), 'png').mockReturnValue(
        Promise.resolve(new Blob()) as any,
      );

      await user.click(screen.getByRole('button', { name: 'Download image' }));

      await waitFor(() => expect(click).toHaveBeenCalled());
    });

    /**
     * Verifies: Print puts the graph on the page as an image, names the document for a PDF, and tidies up after.
     * Interacts with: Print, window.print (fake), the afterprint event.
     * Data: workspace dev.
     */
    it('prints just the graph', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => {});
      const { graph, user } = await renderTopology(topology());
      vi.spyOn(graph(), 'png').mockReturnValue('data:image/png;base64,' as any);
      const title = document.title;

      await user.click(screen.getByRole('button', { name: 'Print' }));
      const img = document.body.querySelector<HTMLImageElement>(
        'img.cas-topology-print',
      );
      img.dispatchEvent(new Event('load'));

      expect(print).toHaveBeenCalled();
      expect(document.title).toBe('dev-topology');

      window.dispatchEvent(new Event('afterprint'));
      expect(document.body.querySelector('img.cas-topology-print')).toBeNull();
      expect(document.title).toBe(title);
    });

    /**
     * Verifies: full screen follows the document, so Esc and the button both leave it, and a refusal says why.
     * Interacts with: Full screen, the fullscreenchange event, requestFullscreen/exitFullscreen (fakes).
     * Data: a refused request, then the document entering and leaving full screen.
     */
    it('goes full screen', async () => {
      let fullscreenElement: Element = null;
      Object.defineProperty(document, 'fullscreenElement', {
        get: () => fullscreenElement,
        configurable: true,
      });
      const exitFullscreen = vi.fn();
      Object.defineProperty(document, 'exitFullscreen', {
        value: exitFullscreen,
        configurable: true,
      });
      HTMLElement.prototype.requestFullscreen = vi.fn(() =>
        Promise.reject(new Error('not allowed')),
      );
      const { user, container } = await renderTopology(topology());

      await user.click(screen.getByRole('button', { name: 'Full screen' }));
      expect(
        await screen.findByText('Could not go full screen: not allowed'),
      ).toBeInTheDocument();

      fullscreenElement = container.querySelector('.topology');
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(
        await screen.findByRole('button', { name: 'Exit full screen' }),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: 'Exit full screen' }),
      );
      expect(exitFullscreen).toHaveBeenCalled();

      delete (HTMLElement.prototype as { requestFullscreen?: unknown })
        .requestFullscreen;
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
      delete (document as { exitFullscreen?: unknown }).exitFullscreen;
    });

    /**
     * Verifies: Fit to view fits the whole graph.
     * Interacts with: Fit to view.
     * Data: the default topology.
     */
    it('fits the graph to the view', async () => {
      const { graph, user } = await renderTopology(topology());
      const fit = vi.spyOn(graph(), 'fit');

      await user.click(screen.getByRole('button', { name: 'Fit to view' }));

      expect(fit).toHaveBeenCalledWith(undefined, 30);
    });
  });
});
