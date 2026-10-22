// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ComnAuthQuery, CrucibleDialogService } from '@cmusei/crucible-common';
import type {
  Core,
  ElementDefinition,
  NodeCollection,
  NodeSingular,
  StylesheetJson,
} from 'cytoscape';
import { Subject, merge } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  skip,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';
import {
  Run,
  RunStatus,
  TopologyNode,
  TopologyNodeKind,
  TopologyNodeLayout,
  TopologyNodeRole,
  TopologySource,
  WorkspaceTopology,
  WorkspacesService,
} from '../../../generated/caster-api';
import { WorkspaceQuery } from '../../state';
import {
  EXTERNAL_NETWORK_ICON,
  MACHINE_ICON,
  NETWORK_ICON,
  ROLE_OPTIONS,
  iconImage,
} from './topology-icons';

/** Border colours for what the plan does to a node; mid tones that read on light and dark. */
const ACTION_COLORS: Record<string, string> = {
  create: '#43a047',
  update: '#1e88e5',
  replace: '#fb8c00',
  delete: '#e53935',
};

/** What each outline means, for the legend. */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  create: 'Applying this plan creates it',
  update: 'Applying this plan changes it in place',
  replace: 'Applying this plan destroys it and builds it again',
  delete: 'Applying this plan destroys it',
};

/**
 * How the topology is laid out, chosen by each viewer. Each keeps its own
 * saved arrangement, so moving a node in one leaves the other as it was.
 */
type LayoutStyle = 'tree' | 'force';
const LAYOUT_STYLE_KEY = 'caster.topology.layoutStyle';

/** Where each layout saves a node's position. */
const POSITION_KEYS: Record<LayoutStyle, ['x', 'y'] | ['treeX', 'treeY']> = {
  force: ['x', 'y'],
  tree: ['treeX', 'treeY'],
};

/** What each layout is called in the view. */
const LAYOUT_NAMES: Record<LayoutStyle, string> = {
  force: 'grouped',
  tree: 'tree',
};

/** Runs whose plan has not yet been applied, rejected or failed: its changes are still to come. */
const PENDING: RunStatus[] = [
  RunStatus.Planned,
  RunStatus.ApplyQueued,
  RunStatus.Applying,
];

@Component({
  selector: 'cas-workspace-topology',
  templateUrl: './workspace-topology.component.html',
  styleUrls: ['./workspace-topology.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class WorkspaceTopologyComponent implements OnInit, OnDestroy {
  @Input() workspaceId: string;
  /** Whether the reader may save the layout and roles; anyone can still drag nodes about. */
  @Input() canEdit: boolean;

  @ViewChild('graph', { static: true }) graph: ElementRef<HTMLElement>;
  @ViewChild('root', { static: true }) root: ElementRef<HTMLElement>;

  topology: WorkspaceTopology;
  selected: TopologyNode;
  loading = true;
  isFullscreen = false;
  error: string;
  readonly actionColors = ACTION_COLORS;
  readonly actionDescriptions = ACTION_DESCRIPTIONS;
  readonly roleOptions = ROLE_OPTIONS;
  layoutStyle: LayoutStyle =
    localStorage.getItem(LAYOUT_STYLE_KEY) === 'force' ? 'force' : 'tree';

  private cy: Core;
  private nodesById = new Map<string, TopologyNode>();
  private runs: Run[] = [];
  /** Nodes moved or given a role since the layout was last saved. */
  private unsaved = new Set<string>();
  private save$ = new Subject<void>();
  private unsubscribe$ = new Subject<void>();

  constructor(
    private workspacesService: WorkspacesService,
    private workspaceQuery: WorkspaceQuery,
    private authQuery: ComnAuthQuery,
    private changeDetector: ChangeDetectorRef,
    private zone: NgZone,
    private host: ElementRef<HTMLElement>,
    private snackBar: MatSnackBar,
    private dialogService: CrucibleDialogService
  ) {}

  ngOnInit() {
    // A run that finishes planning has a new topology, and one that is
    // applied or rejected changes what its outlines mean. Refetch whenever a
    // run's status changes rather than on every output line. Unfiltered, so
    // hiding statuses in the Runs view cannot hide the plan's run.
    const runsChanged$ = this.workspaceQuery
      .selectEntity(this.workspaceId, (w) => w.runs)
      .pipe(
        // undefined until the workspace's runs have loaded
        map((runs) => (this.runs = runs ?? [])),
        map((runs) => runs.map((r) => `${r.id}:${r.status}`).join(',')),
        distinctUntilChanged(),
        skip(1),
        debounceTime(500)
      );

    merge([null], runsChanged$)
      .pipe(
        switchMap(() =>
          this.workspacesService.getWorkspaceTopology(this.workspaceId)
        ),
        takeUntil(this.unsubscribe$)
      )
      .subscribe({
        next: (topology) => this.show(topology),
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.title ?? err?.message ?? 'Unknown error';
          this.changeDetector.markForCheck();
        },
      });

    // A drag ends in one dragfree per node moved; save them together.
    this.save$
      .pipe(debounceTime(400), takeUntil(this.unsubscribe$))
      .subscribe(() => this.saveLayout());

    // Cytoscape cannot read CSS variables, so restyle when the theme flips.
    this.authQuery.userTheme$
      .pipe(skip(1), takeUntil(this.unsubscribe$))
      .subscribe(() =>
        setTimeout(() => this.cy?.style(this.stylesheet() as any))
      );
  }

  get isEmpty(): boolean {
    return !this.topology?.nodes?.length;
  }

  /** Status of the run the topology's plan belongs to, once the runs have loaded. */
  get planStatus(): RunStatus {
    return this.runs.find((r) => r.id === this.topology?.runId)?.status;
  }

  /**
   * Whether the plan's changes are still to come. Once it is applied,
   * rejected or failed, the API draws the state instead, and "create" no
   * longer describes anything, so the outlines go. The run's status is
   * checked too: it can change before the topology is refetched, and after
   * a state error the API still draws the plan.
   */
  get showsChanges(): boolean {
    return (
      this.topology?.source !== TopologySource.State &&
      (!this.planStatus || PENDING.includes(this.planStatus))
    );
  }

  /** Whether the apply failed before creating something the plan creates. */
  get hasNotCreated(): boolean {
    return !!this.topology?.nodes?.some((n) => n.notCreated);
  }

  fit() {
    this.cy?.fit(undefined, 30);
  }

  /** The layout in view, as the toolbar names it. */
  get layoutName(): string {
    return LAYOUT_NAMES[this.layoutStyle];
  }

  /** Whether anyone has moved a node in this layout, so there is a layout to reset. */
  get hasSavedPositions(): boolean {
    return Object.keys(this.topology?.layout ?? {}).some(
      (id) => !!this.savedPosition(id)
    );
  }

  roleOf(node: TopologyNode): TopologyNodeRole {
    return this.topology?.layout?.[node.id]?.role ?? null;
  }

  setRole(node: TopologyNode, role: TopologyNodeRole) {
    this.cy?.getElementById(node.id).data('role', role ?? '');
    this.remember(node.id, { ...this.topology.layout?.[node.id], role });
    this.saveLayout();
  }

  /**
   * Forget where everyone put the nodes in this layout, for everyone, and lay
   * them all out afresh. Roles, and the other layout, stay.
   */
  resetLayout() {
    this.dialogService
      .confirm({
        title: 'Reset Layout',
        message: `Lay out the ${this.layoutName} layout afresh? This forgets where nodes were moved to in it, for everyone who views this workspace.`,
        confirmText: 'Reset',
        cancelText: 'Cancel',
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        const [x, y] = POSITION_KEYS[this.layoutStyle];
        Object.entries(this.topology.layout ?? {}).forEach(([id, node]) =>
          this.remember(id, { ...node, [x]: null, [y]: null })
        );
        this.saveLayout();
        this.redraw();
      });
  }

  /** Switch between the tree and the force-directed layout, each as it was saved. */
  toggleLayoutStyle() {
    this.layoutStyle = this.layoutStyle === 'tree' ? 'force' : 'tree';
    localStorage.setItem(LAYOUT_STYLE_KEY, this.layoutStyle);
    this.redraw();
  }

  private redraw() {
    this.cy?.nodes('[kind]').positions({ x: 0, y: 0 });
    this.layout();
    this.changeDetector.markForCheck();
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    this.root.nativeElement
      .requestFullscreen()
      .catch((err) =>
        this.snackBar.open(`Could not go full screen: ${err?.message ?? err}`, 'Dismiss')
      );
  }

  /** Esc leaves full screen without the button, so follow the document rather than the toggle. */
  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.isFullscreen = document.fullscreenElement === this.root.nativeElement;
    this.changeDetector.markForCheck();
    // Cytoscape only notices the window resizing, not its container.
    requestAnimationFrame(() => {
      this.cy?.resize();
      this.fit();
    });
  }

  copyImage() {
    // Hand the clipboard the promise rather than awaiting it first: Safari
    // drops the user gesture across an await and refuses the write.
    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': this.image() })])
      .then(
        () => this.snackBar.open('Copied to clipboard', 'Dismiss'),
        (err) =>
          this.snackBar.open(`Could not copy the image: ${err?.message ?? err}`, 'Dismiss')
      );
  }

  async downloadImage() {
    const url = URL.createObjectURL(await this.image());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.fileName()}.png`;
    link.click();
    // Not straight away: the browser may not have started reading it yet.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Print just the graph: put it on the page as an image, and hide the rest
   * of Caster from the printer while it prints.
   */
  print() {
    if (!this.cy) {
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
      @media screen { .cas-topology-print { display: none; } }
      @media print {
        body > :not(.cas-topology-print) { display: none !important; }
        .cas-topology-print { display: block; max-width: 100%; max-height: 100vh; margin: auto; }
      }`;
    const img = document.createElement('img');
    img.className = 'cas-topology-print';
    img.src = this.cy.png(this.imageOptions());

    const title = document.title;
    const cleanUp = () => {
      style.remove();
      img.remove();
      document.title = title;
    };

    img.onload = () => {
      window.addEventListener('afterprint', cleanUp, { once: true });
      // Names the file when the reader prints to PDF.
      document.title = this.fileName();
      window.print();
    };
    document.head.appendChild(style);
    document.body.appendChild(img);
  }

  private image(): Promise<Blob> {
    return this.cy.png({ ...this.imageOptions(), output: 'blob-promise' });
  }

  /** The whole graph, not just what is scrolled into view, on the theme background. */
  private imageOptions() {
    return {
      full: true,
      scale: 2,
      bg: this.themeColor('--mat-sys-surface', '#ffffff'),
    };
  }

  private fileName(): string {
    const name = this.workspaceQuery.getEntity(this.workspaceId)?.name;
    return `${name ?? 'workspace'}-topology`;
  }

  propertiesOf(node: TopologyNode): { key: string; value: string }[] {
    return Object.entries(node.properties ?? {}).map(([key, value]) => ({
      key,
      value,
    }));
  }

  networksOf(node: TopologyNode): { iface: number; label: string }[] {
    return (this.topology?.edges ?? [])
      .filter((e) => e.from === node.id)
      .sort((a, b) => a.nic - b.nic)
      .map((e) => ({
        iface: e.nic,
        label: this.nodesById.get(e.to)?.label ?? e.to,
      }));
  }

  machinesOn(node: TopologyNode): string[] {
    return (this.topology?.edges ?? [])
      .filter((e) => e.to === node.id)
      .map((e) => this.nodesById.get(e.from)?.label ?? e.from)
      .sort();
  }

  private async show(topology: WorkspaceTopology) {
    // A change still waiting to be saved is newer than what was fetched.
    if (this.unsaved.size) {
      const layout = { ...topology.layout };
      this.unsaved.forEach((id) => {
        const node = this.topology?.layout?.[id];
        if (node) {
          layout[id] = node;
        } else {
          delete layout[id];
        }
      });
      topology = { ...topology, layout };
    }
    this.topology = topology;
    this.loading = false;
    this.error = null;
    this.nodesById = new Map((topology.nodes ?? []).map((n) => [n.id, n]));

    if (this.selected) {
      this.selected = this.nodesById.get(this.selected.id);
    }

    // Now, not on the next tick: cytoscape measures its container when it
    // is created, and the container is hidden until there is something in it.
    this.changeDetector.detectChanges();

    if (this.isEmpty) {
      this.cy?.destroy();
      this.cy = null;
      return;
    }

    const elements = this.elements(topology);

    if (this.cy) {
      this.cy.elements().remove();
      this.cy.add(elements);
      this.layout();
      return;
    }

    // Loaded on first use so the rest of Caster does not pay for it.
    const cytoscape = (await import('cytoscape')).default;

    this.zone.runOutsideAngular(() => {
      this.cy = cytoscape({
        container: this.graph.nativeElement,
        elements,
        // Otherwise cytoscape lays them out in a grid, over the saved
        // positions; layout() below places what has none.
        layout: { name: 'preset' },
        style: this.stylesheet() as any,
        minZoom: 0.2,
        maxZoom: 3,
        wheelSensitivity: 0.3,
      });

      this.cy.on('tap', 'node[kind]', (event) =>
        this.zone.run(() => {
          this.selected = this.nodesById.get(event.target.id());
          this.changeDetector.markForCheck();
        })
      );
      this.cy.on('dragfree', 'node', (event) => {
        // Dragging a module box moves what is in it.
        const moved = event.target.union(event.target.descendants()).filter('[kind]');
        this.zone.run(() => this.moved(moved.map((n) => n.id())));
      });
      this.cy.on('tap', (event) => {
        if (event.target === this.cy) {
          this.zone.run(() => {
            this.selected = null;
            this.changeDetector.markForCheck();
          });
        }
      });

      this.layout();
    });
  }

  /**
   * Lay out what nobody has placed, around what they have. The tree comes
   * out the same each time, so it is drawn whole and the placed nodes moved
   * to where they were saved. With the force layout, locking the placed
   * nodes keeps cose from pushing the others through them, but cose still
   * moves them, so they are put back where they were saved after.
   */
  private layout() {
    const nodes = this.cy.nodes('[kind]');
    const placed = nodes.filter((n) => !!this.savedPosition(n.id()));

    if (placed.length === nodes.length) {
      // A redraw stacked them all at the origin.
      placed.forEach((n) => {
        n.position(this.savedPosition(n.id()));
      });
      this.fit();
      return;
    }

    if (this.layoutStyle === 'tree') {
      this.layoutTree();
    } else {
      placed.forEach((n) => {
        n.position(this.savedPosition(n.id()));
      });
      placed.lock();
      this.cy
        .layout({
          name: 'cose',
          animate: false,
          padding: 30,
          nodeRepulsion: () => 12000,
          idealEdgeLength: () => 90,
          randomize: false,
        } as any)
        .run();
      placed.unlock();
    }
    placed.forEach((n) => {
      n.position(this.savedPosition(n.id()));
    });
    this.fit();
  }

  /**
   * A tree for each connected part of the graph, rooted at its busiest
   * external network (the uplink everything hangs off), or its busiest node
   * when it has none. Each node sits centred over what hangs off it, and each
   * subtree is as wide as its labels need, so nothing overlaps.
   */
  private layoutTree() {
    const graph = this.cy.nodes('[kind]').union(this.cy.edges());
    const busiest = (nodes: NodeCollection) =>
      nodes.max((n) => n.degree(false)).ele as NodeSingular;
    const gap = 16;
    const width = (n: NodeSingular) =>
      n.boundingBox({ includeLabels: true } as any).w + gap;
    const rowHeight =
      Math.max(
        ...graph.nodes().map((n) => n.boundingBox({ includeLabels: true } as any).h)
      ) + 40;
    const positions: Record<string, { x: number; y: number }> = {};
    let left = 0;

    graph.components().forEach((part) => {
      const external = part.nodes('.external');
      const root = busiest(external.nonempty() ? external : part.nodes());

      // Breadth first, so each node hangs off the nearest one to the root.
      const children = new Map<string, NodeSingular[]>();
      const seen = new Set([root.id()]);
      const queue = [root];
      while (queue.length) {
        const node = queue.shift();
        const next = node
          .neighborhood('node[kind]')
          .filter((n) => !seen.has(n.id()))
          .sort((a, b) =>
            (a.data('label') ?? '').localeCompare(b.data('label') ?? '', undefined, {
              numeric: true,
            })
          )
          .toArray() as NodeSingular[];
        next.forEach((n) => seen.add(n.id()));
        children.set(node.id(), next);
        queue.push(...next);
      }

      const spans = new Map<string, number>();
      const span = (node: NodeSingular): number => {
        const below = children
          .get(node.id())
          .reduce((sum, child) => sum + span(child), 0);
        const own = Math.max(width(node), below);
        spans.set(node.id(), own);
        return own;
      };
      span(root);
      const place = (node: NodeSingular, x: number, depth: number) => {
        const own = spans.get(node.id());
        positions[node.id()] = { x: x + own / 2, y: depth * rowHeight };
        const kids = children.get(node.id());
        const below = kids.reduce((sum, child) => sum + spans.get(child.id()), 0);
        let next = x + (own - below) / 2;
        kids.forEach((child) => {
          place(child, next, depth + 1);
          next += spans.get(child.id());
        });
      };

      place(root, left, 0);
      left += spans.get(root.id()) + gap * 4;
    });

    graph
      .nodes()
      .layout({ name: 'preset', positions, animate: false } as any)
      .run();
  }

  private savedPosition(id: string): { x: number; y: number } {
    const node = this.topology?.layout?.[id];
    const [x, y] = POSITION_KEYS[this.layoutStyle];
    return node?.[x] != null && node?.[y] != null
      ? { x: node[x], y: node[y] }
      : null;
  }

  /** Nodes someone dragged: keep where they are now, and save it if they may. */
  private moved(ids: string[]) {
    if (!this.canEdit) {
      return;
    }
    const [kx, ky] = POSITION_KEYS[this.layoutStyle];
    ids.forEach((id) => {
      const { x, y } = this.cy.getElementById(id).position();
      this.remember(id, {
        ...this.topology.layout?.[id],
        [kx]: Math.round(x),
        [ky]: Math.round(y),
      });
    });
    // Reset layout is enabled by what was just saved.
    this.changeDetector.markForCheck();
    this.save$.next();
  }

  /**
   * Change a node's layout here straight away, so a refetch or another
   * change before the save returns does not undo it, and mark it unsaved.
   */
  private remember(id: string, node: TopologyNodeLayout) {
    const layout = { ...this.topology.layout };
    if (
      node.x == null &&
      node.y == null &&
      node.treeX == null &&
      node.treeY == null &&
      node.role == null
    ) {
      delete layout[id];
    } else {
      layout[id] = node;
    }
    this.topology = { ...this.topology, layout };
    this.unsaved.add(id);
  }

  private saveLayout() {
    if (!this.unsaved.size) {
      return;
    }
    const nodes: Record<string, TopologyNodeLayout> = {};
    this.unsaved.forEach((id) => (nodes[id] = this.topology.layout?.[id] ?? null));
    this.unsaved.clear();

    this.workspacesService
      .editWorkspaceTopologyLayout(this.workspaceId, { nodes })
      .subscribe({
        error: (err) =>
          this.snackBar.open(
            `Could not save the layout: ${err?.error?.title ?? err?.message ?? err}`,
            'Dismiss'
          ),
      });
  }

  private elements(topology: WorkspaceTopology): ElementDefinition[] {
    const nodes = topology.nodes ?? [];

    // A module instance with one resource in it (module.host["dc"]) is just
    // that resource; only box modules that group several.
    const moduleCounts = new Map<string, number>();
    nodes
      .filter((n) => n.module)
      .forEach((n) => moduleCounts.set(n.module, (moduleCounts.get(n.module) ?? 0) + 1));
    const boxed = [...moduleCounts].filter(([, count]) => count > 1).map(([m]) => m);

    return [
      ...boxed.map((m) => ({
        group: 'nodes' as const,
        data: { id: `module:${m}`, label: m },
        classes: 'module',
      })),
      ...nodes.map((n) => ({
        group: 'nodes' as const,
        position: this.savedPosition(n.id) ?? undefined,
        data: {
          id: n.id,
          label: n.label,
          kind: n.kind,
          action: this.showsChanges ? (n.action ?? '') : '',
          notCreated: !!n.notCreated,
          role: topology.layout?.[n.id]?.role ?? '',
          parent: boxed.includes(n.module) ? `module:${n.module}` : undefined,
        },
        classes: [
          n.kind === TopologyNodeKind.Machine ? 'machine' : 'network',
          n.external ? 'external' : '',
        ].join(' '),
      })),
      ...(topology.edges ?? []).map((e) => ({
        group: 'edges' as const,
        data: {
          id: `${e.from}#${e.nic}`,
          source: e.from,
          target: e.to,
          label: `nic${e.nic}`,
        },
      })),
    ];
  }

  private stylesheet(): StylesheetJson {
    const color = (name: string, fallback: string) =>
      this.themeColor(name, fallback);

    const text = color('--mat-sys-on-surface', '#1b1b1f');
    const muted = color('--mat-sys-on-surface-variant', '#46464f');
    const surface = color('--mat-sys-surface-container-high', '#e9e7ec');
    const box = color('--mat-sys-surface-container-low', '#f5f3f7');
    const outline = color('--mat-sys-outline', '#777680');
    const primary = color('--mat-sys-primary', '#3f51b5');
    const onPrimary = color('--mat-sys-on-primary', '#ffffff');
    const selected = color('--mat-sys-tertiary', '#ff4081');
    const error = color('--mat-sys-error', '#ba1a1a');

    return [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          color: text,
          'font-size': 11,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'background-color': surface,
          'border-width': 2,
          'border-color': outline,
        },
      },
      {
        selector: 'node.machine',
        style: {
          shape: 'round-rectangle',
          width: 44,
          height: 36,
          'background-image': iconImage(MACHINE_ICON, text),
          'background-width': 24,
          'background-height': 24,
        },
      },
      ...ROLE_OPTIONS.map((option) => ({
        selector: `node.machine[role = "${option.role}"]`,
        style: { 'background-image': iconImage(option.path, text) },
      })),
      {
        selector: 'node.network',
        style: {
          shape: 'ellipse',
          width: 32,
          height: 32,
          'background-color': primary,
          'border-color': primary,
          'background-image': iconImage(NETWORK_ICON, onPrimary),
          'background-width': 18,
          'background-height': 18,
        },
      },
      {
        selector: 'node.external',
        style: {
          'background-opacity': 0,
          'border-style': 'dashed',
          'border-color': muted,
          'background-image': iconImage(EXTERNAL_NETWORK_ICON, muted),
        },
      },
      ...Object.entries(ACTION_COLORS).map(([action, value]) => ({
        selector: `node[action = "${action}"]`,
        style: { 'border-color': value, 'border-width': 3 },
      })),
      {
        selector: 'node[action = "delete"]',
        style: { opacity: 0.6, 'border-style': 'dashed' },
      },
      {
        selector: 'node[?notCreated]',
        style: {
          opacity: 0.6,
          'background-opacity': 0,
          'border-style': 'dashed',
          'border-color': error,
        },
      },
      {
        selector: 'node.module',
        style: {
          shape: 'round-rectangle',
          'background-color': box,
          'border-color': outline,
          'border-width': 1,
          'border-style': 'dotted',
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-y': -4,
          color: muted,
          'font-size': 10,
          padding: '14px',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.5,
          'line-color': outline,
          'curve-style': 'bezier',
          label: 'data(label)',
          'font-size': 8,
          color: muted,
          'text-rotation': 'autorotate',
          'text-background-color': box,
          'text-background-opacity': 1,
          'text-background-padding': '1px',
        },
      },
      {
        selector: 'node:selected',
        style: { 'overlay-color': selected, 'overlay-opacity': 0.25 },
      },
    ] as StylesheetJson;
  }

  /**
   * A theme colour as rgb(). The theme defines most as light-dark(...), which
   * cytoscape cannot parse, so let the browser resolve it through a probe.
   */
  private themeColor(name: string, fallback: string): string {
    const probe = document.createElement('span');
    probe.style.display = 'none';
    probe.style.color = `var(${name}, ${fallback})`;
    this.host.nativeElement.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }

  ngOnDestroy() {
    // A drag just before leaving still counts.
    this.saveLayout();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    this.cy?.destroy();
  }
}
