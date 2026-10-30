// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import type { Core, EdgeSingular, NodeSingular } from 'cytoscape';

/**
 * The graph as a self-contained SVG, drawn from what cytoscape has laid out and styled: the same shapes,
 * borders, icons and labels as the canvas, on a white page. Icons are written as paths rather than as the
 * images cytoscape draws them from, so the file needs nothing else to show, as an image anywhere.
 */
export function topologySvg(
  cy: Core,
  options: { padding?: number; background?: string } = {},
): string {
  const padding = options.padding ?? 20;
  const box = cy
    .elements()
    .boundingBox({ includeLabels: true, includeOverlays: false });
  const x = box.x1 - padding;
  const y = box.y1 - padding;
  const width = Math.ceil(box.w + 2 * padding);
  const height = Math.ceil(box.h + 2 * padding);

  const nodes = cy.nodes().toArray() as NodeSingular[];
  const parents = nodes.filter((n) => n.isParent());
  const leaves = nodes.filter((n) => !n.isParent());
  const parts = [
    `<rect x="${n(x)}" y="${n(y)}" width="${width}" height="${height}" fill="${options.background ?? '#ffffff'}"/>`,
    // cytoscape draws module boxes under their machines, and edges under the nodes
    ...parents.map((p) => nodeSvg(p)),
    ...(cy.edges().toArray() as EdgeSingular[]).map((e) => edgeSvg(e)),
    ...leaves.map((l) => nodeSvg(l)),
  ];

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="${n(x)} ${n(y)} ${width} ${height}">` +
    parts.join('') +
    `</svg>`
  );
}

function nodeSvg(node: NodeSingular): string {
  const b = node.boundingBox({ includeLabels: false, includeOverlays: false });
  const border = px(node.style('border-width'));
  const inset = border / 2;
  const w = b.w - border;
  const h = b.h - border;
  const fillOpacity = num(node.style('background-opacity'), 1);
  const stroke =
    border > 0
      ? ` stroke="${node.style('border-color')}" stroke-width="${n(border)}"${dash(node.style('border-style'))}`
      : '';
  const fill = ` fill="${node.style('background-color')}" fill-opacity="${n(fillOpacity)}"`;
  const shape =
    node.style('shape') === 'ellipse'
      ? `<ellipse cx="${n(b.x1 + b.w / 2)}" cy="${n(b.y1 + b.h / 2)}" rx="${n(w / 2)}" ry="${n(h / 2)}"${fill}${stroke}/>`
      : `<rect x="${n(b.x1 + inset)}" y="${n(b.y1 + inset)}" width="${n(w)}" height="${n(h)}" ` +
        `rx="${n(cornerRadius(node, w, h))}"${fill}${stroke}/>`;

  const opacity = num(node.style('opacity'), 1);
  return (
    `<g${opacity < 1 ? ` opacity="${n(opacity)}"` : ''}>` +
    shape +
    iconSvg(node, b) +
    labelSvg(node, b) +
    `</g>`
  );
}

/** cytoscape's round-rectangle corner, which it scales with the node up to a limit. */
function cornerRadius(node: NodeSingular, w: number, h: number): number {
  if (node.style('shape') !== 'round-rectangle') return 0;
  return Math.min(w / 4, h / 4, 8);
}

/** The node's icon, read back out of the data URL the stylesheet gave cytoscape (see iconImage). */
function iconSvg(
  node: NodeSingular,
  b: { x1: number; y1: number; w: number; h: number },
): string {
  const image = node.style('background-image');
  const src = Array.isArray(image) ? image[0] : image;
  if (!src || src === 'none' || !src.startsWith('data:image/svg+xml'))
    return '';
  const svg = decodeURIComponent(src.slice(src.indexOf(',') + 1));
  const path = /<path[^>]*\sd="([^"]+)"/.exec(svg)?.[1];
  const fill = /<path[^>]*\sfill="([^"]+)"/.exec(svg)?.[1] ?? '#000000';
  if (!path) return '';
  const size = px(first(node.style('background-width')));
  const scale = size / 24;
  const cx = b.x1 + b.w / 2;
  const cy = b.y1 + b.h / 2;
  return (
    `<path transform="translate(${n(cx - size / 2)} ${n(cy - size / 2)}) scale(${n(scale)})" ` +
    `fill="${escapeXml(fill)}" d="${escapeXml(path)}"/>`
  );
}

function labelSvg(
  node: NodeSingular,
  b: { x1: number; y1: number; y2: number; w: number },
): string {
  const text = String(node.style('label') ?? '');
  if (!text) return '';
  const size = px(node.style('font-size'));
  const marginY = px(node.style('text-margin-y'));
  const top = node.style('text-valign') === 'top';
  // a bottom label hangs from the node; a top one, a module's name, sits on it
  const y = top ? b.y1 + marginY : b.y2 + marginY + size;
  return (
    `<text x="${n(b.x1 + b.w / 2)}" y="${n(y)}" text-anchor="middle" ` +
    `font-family="${escapeXml(fontFamily(node))}" font-size="${n(size)}" fill="${node.style('color')}">` +
    `${escapeXml(text)}</text>`
  );
}

function edgeSvg(edge: EdgeSingular): string {
  const s = edge.sourceEndpoint();
  const t = edge.targetEndpoint();
  const cps = edge.controlPoints() as { x: number; y: number }[] | undefined;
  const d = cps?.length
    ? `M${n(s.x)} ${n(s.y)} Q${n(cps[0].x)} ${n(cps[0].y)} ${n(t.x)} ${n(t.y)}`
    : `M${n(s.x)} ${n(s.y)} L${n(t.x)} ${n(t.y)}`;
  const line =
    `<path d="${d}" fill="none" stroke="${edge.style('line-color')}" ` +
    `stroke-width="${n(px(edge.style('width')))}"${dash(edge.style('line-style'))}/>`;
  return `<g>${line}${edgeLabelSvg(edge, s, t)}</g>`;
}

/** An edge label at the edge's middle, turned with the line as autorotate does, on its background. */
function edgeLabelSvg(
  edge: EdgeSingular,
  s: { x: number; y: number },
  t: { x: number; y: number },
): string {
  const text = String(edge.style('label') ?? '');
  if (!text) return '';
  const m = edge.midpoint();
  const size = px(edge.style('font-size'));
  let angle = (Math.atan2(t.y - s.y, t.x - s.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const pad = px(edge.style('text-background-padding'));
  const font = fontFamily(edge);
  const w = textWidth(text, size, font) + 2 * pad;
  const h = size + 2 * pad;
  const background =
    num(edge.style('text-background-opacity'), 0) > 0
      ? `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" ` +
        `fill="${edge.style('text-background-color')}"/>`
      : '';
  return (
    `<g transform="translate(${n(m.x)} ${n(m.y)}) rotate(${n(angle)})">` +
    background +
    `<text y="${n(size * 0.35)}" text-anchor="middle" font-family="${escapeXml(font)}" ` +
    `font-size="${n(size)}" fill="${edge.style('color')}">${escapeXml(text)}</text></g>`
  );
}

function fontFamily(ele: NodeSingular | EdgeSingular): string {
  return String(
    ele.style('font-family') || 'Helvetica Neue, Helvetica, sans-serif',
  );
}

let measure: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, size: number, font: string): number {
  measure ??= document.createElement('canvas').getContext('2d');
  if (!measure) return text.length * size * 0.55;
  measure.font = `${size}px ${font}`;
  return measure.measureText(text).width;
}

function dash(style: string): string {
  if (style === 'dashed') return ' stroke-dasharray="6 4"';
  if (style === 'dotted')
    return ' stroke-dasharray="1 3" stroke-linecap="round"';
  return '';
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function px(value: unknown): number {
  return parseFloat(String(value)) || 0;
}

function num(value: unknown, fallback: number): number {
  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
