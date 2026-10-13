// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ComnAuthQuery } from '@cmusei/crucible-common';
import type { Core, ElementDefinition, StylesheetJson } from 'cytoscape';
import { Subject, merge } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  skip,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import {
  Run,
  RunStatus,
  TopologyNode,
  TopologyNodeKind,
  WorkspaceTopology,
  WorkspacesService,
} from '../../../generated/caster-api';
import { WorkspaceQuery } from '../../state';

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

  @ViewChild('graph', { static: true }) graph: ElementRef<HTMLElement>;

  topology: WorkspaceTopology;
  selected: TopologyNode;
  loading = true;
  error: string;
  readonly actionColors = ACTION_COLORS;
  readonly actionDescriptions = ACTION_DESCRIPTIONS;

  private cy: Core;
  private nodesById = new Map<string, TopologyNode>();
  private runs: Run[] = [];
  private unsubscribe$ = new Subject<void>();

  constructor(
    private workspacesService: WorkspacesService,
    private workspaceQuery: WorkspaceQuery,
    private authQuery: ComnAuthQuery,
    private changeDetector: ChangeDetectorRef,
    private zone: NgZone,
    private host: ElementRef<HTMLElement>,
    private snackBar: MatSnackBar
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
   * rejected or failed, "create" no longer describes anything, so the
   * outlines go.
   */
  get showsChanges(): boolean {
    return !this.planStatus || PENDING.includes(this.planStatus);
  }

  fit() {
    this.cy?.fit(undefined, 30);
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

  private layout() {
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
        data: {
          id: n.id,
          label: n.label,
          kind: n.kind,
          action: this.showsChanges ? (n.action ?? '') : '',
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
    const selected = color('--mat-sys-tertiary', '#ff4081');

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
          height: 32,
        },
      },
      {
        selector: 'node.network',
        style: {
          shape: 'ellipse',
          width: 28,
          height: 28,
          'background-color': primary,
          'border-color': primary,
        },
      },
      {
        selector: 'node.external',
        style: {
          'background-opacity': 0,
          'border-style': 'dashed',
          'border-color': muted,
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
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    this.cy?.destroy();
  }
}
