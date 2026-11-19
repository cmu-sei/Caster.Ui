// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import cytoscape, {
  type Core,
  type ElementDefinition,
  type StylesheetJson,
} from 'cytoscape';
import { mdiServer, mdiWallFire } from '@mdi/js';
import { topologySvg } from './topology-svg';

// The icon data URL the topology stylesheet hands cytoscape (as iconImage in topology-icons.ts).
function icon(path: string, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<path fill="${color}" d="${path}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const STYLE = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      color: '#1b1b1f',
      'font-size': 11,
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'background-color': '#e9e7ec',
      'border-width': 2,
      'border-color': '#777680',
    },
  },
  {
    selector: 'node.machine',
    style: {
      shape: 'round-rectangle',
      width: 44,
      height: 36,
      'background-image': icon(mdiServer, '#1b1b1f'),
      'background-width': 24,
      'background-height': 24,
    },
  },
  {
    selector: 'node[role = "Firewall"]',
    style: { 'background-image': icon(mdiWallFire, '#1b1b1f') },
  },
  {
    selector: 'node.network',
    style: {
      shape: 'ellipse',
      width: 32,
      height: 32,
      'background-color': '#3f51b5',
    },
  },
  { selector: 'node.external', style: { 'border-style': 'dashed' } },
  {
    selector: 'node.module',
    style: {
      shape: 'round-rectangle',
      'border-style': 'dotted',
      'text-valign': 'top',
      padding: '14px',
    },
  },
  {
    selector: 'node[?notCreated]',
    style: { opacity: 0.6 },
  },
  {
    selector: 'edge',
    style: {
      width: 1.5,
      'line-color': '#777680',
      'curve-style': 'bezier',
      label: 'data(label)',
      'font-size': 8,
      'text-background-color': '#f5f3f7',
      'text-background-opacity': 1,
      'text-background-padding': '1px',
    },
  },
] as StylesheetJson;

const ELEMENTS: ElementDefinition[] = [
  { data: { id: 'mod', label: 'module: dmz' }, classes: 'module' },
  {
    data: { id: 'wan', label: 'vmbr0' },
    classes: 'network external',
    position: { x: 200, y: 0 },
  },
  {
    data: { id: 'lan', label: 'lan' },
    classes: 'network',
    position: { x: 200, y: 200 },
  },
  {
    data: { id: 'fw', label: 'fw & <edge>', role: 'Firewall' },
    classes: 'machine',
    position: { x: 200, y: 100 },
  },
  {
    data: { id: 'web', label: 'web-01', parent: 'mod' },
    classes: 'machine',
    position: { x: 100, y: 300 },
  },
  {
    data: { id: 'kali', label: 'kali', notCreated: true },
    classes: 'machine',
    position: { x: 300, y: 300 },
  },
  { data: { id: 'e1', source: 'fw', target: 'wan', label: 'eth0' } },
  { data: { id: 'e2', source: 'fw', target: 'lan', label: 'eth1' } },
  { data: { id: 'e3', source: 'web', target: 'lan', label: 'eth0' } },
];

/** jsdom has no canvas; measuring text by its length is enough for label bounds. */
const getContext = HTMLCanvasElement.prototype.getContext;
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy(
      { measureText: (t: string) => ({ width: t.length * 6 }) } as Record<
        string,
        unknown
      >,
      {
        get: (t, prop) => (prop in t ? t[prop as string] : () => {}),
        set: (t, prop, value) => {
          t[prop as string] = value;
          return true;
        },
      },
    );
  } as unknown as typeof getContext;
});
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
  container?.remove();
});

// Rendered rather than headless: edge endpoints come from cytoscape's renderer.
let container: HTMLElement;
function graph(): Core {
  container = document.createElement('div');
  document.body.appendChild(container);
  return cytoscape({
    container,
    elements: ELEMENTS,
    style: STYLE,
    layout: { name: 'preset' },
  });
}

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('topologySvg', () => {
  /**
   * Verifies: the export is well-formed SVG with its size set, which an SVG must have to be drawn as an
   * image in Firefox, and a white page under the graph.
   * Data: the six-node graph.
   */
  it('writes well-formed SVG with a size and a white page', () => {
    const doc = parse(topologySvg(graph()));

    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    const root = doc.documentElement;
    expect(root.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(Number(root.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(root.getAttribute('height'))).toBeGreaterThan(0);
    expect(root.getAttribute('viewBox')?.split(' ')).toHaveLength(4);
    expect(root.firstElementChild?.getAttribute('fill')).toBe('#ffffff');
  });

  /**
   * Verifies: each node's icon is written as a path, with its colour, and nothing is left as an image, so
   * the file needs nothing else when it is drawn as an image itself.
   * Data: a firewall-role machine and two plain machines.
   */
  it('inlines the icons as paths and embeds no images', () => {
    const doc = parse(topologySvg(graph()));
    const paths = Array.from(doc.getElementsByTagName('path')).map((p) =>
      p.getAttribute('d'),
    );

    expect(doc.getElementsByTagName('image')).toHaveLength(0);
    expect(paths).toContain(mdiWallFire);
    expect(paths.filter((d) => d === mdiServer)).toHaveLength(2);
  });

  /**
   * Verifies: networks are circles, machines and modules rounded rectangles, and the border styles carry
   * over: dashed for an external network, dotted for a module.
   * Data: two networks (one external), three machines, one module.
   */
  it('keeps the shapes and border styles', () => {
    const doc = parse(topologySvg(graph()));

    expect(doc.getElementsByTagName('ellipse')).toHaveLength(2);
    const rects = Array.from(doc.getElementsByTagName('rect'));
    expect(rects.filter((r) => Number(r.getAttribute('rx')) > 0)).toHaveLength(
      4,
    );
    const dashes = Array.from(doc.querySelectorAll('[stroke-dasharray]')).map(
      (e) => e.getAttribute('stroke-dasharray'),
    );
    expect(dashes).toContain('6 4');
    expect(dashes).toContain('1 3');
  });

  /**
   * Verifies: a module box is drawn before its machines and the edges before the nodes, as cytoscape
   * layers them, so nothing is hidden behind a box or a line.
   * Data: the module mod around web-01.
   */
  it('draws module boxes, then edges, then nodes', () => {
    const doc = parse(topologySvg(graph()));
    const texts = Array.from(doc.getElementsByTagName('text')).map(
      (t) => t.textContent,
    );

    expect(texts.indexOf('module: dmz')).toBeLessThan(texts.indexOf('eth0'));
    expect(texts.lastIndexOf('eth0')).toBeLessThan(texts.indexOf('web-01'));
  });

  /**
   * Verifies: labels are escaped, and a machine that is not created yet keeps its faded look.
   * Data: a firewall labelled "fw & <edge>"; kali not created.
   */
  it('escapes labels and keeps a node faded', () => {
    const svg = topologySvg(graph());
    const doc = parse(svg);

    expect(svg).toContain('fw &amp; &lt;edge&gt;');
    expect(
      Array.from(doc.getElementsByTagName('text')).map((t) => t.textContent),
    ).toContain('fw & <edge>');
    expect(doc.querySelector('g[opacity="0.6"] text')?.textContent).toBe(
      'kali',
    );
  });

  /**
   * Verifies: each edge is a line between its nodes with its label on a background.
   * Data: three edges labelled eth0, eth1, eth0.
   */
  it('draws each edge with its label on a background', () => {
    const doc = parse(topologySvg(graph()));
    const lines = Array.from(doc.querySelectorAll('path[fill="none"]'));

    expect(lines).toHaveLength(3);
    expect(
      lines.every(
        (l) =>
          l.getAttribute('stroke') && l.getAttribute('stroke-width') === '1.5',
      ),
    ).toBe(true);
    const labelGroups = Array.from(
      doc.querySelectorAll('g[transform^="translate"]'),
    );
    expect(
      labelGroups.map((g) => g.querySelector('text')?.textContent),
    ).toEqual(['eth0', 'eth1', 'eth0']);
    // cytoscape hands colours back as rgb(), which SVG reads as well
    expect(
      labelGroups.map((g) => g.querySelector('rect')?.getAttribute('fill')),
    ).toEqual(Array(3).fill('rgb(245,243,247)'));
  });
});
