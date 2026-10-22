// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  mdiCloudOutline,
  mdiDatabase,
  mdiEmailOutline,
  mdiIncognito,
  mdiLan,
  mdiLinux,
  mdiMicrosoftWindows,
  mdiMonitor,
  mdiRouterNetwork,
  mdiServer,
  mdiShieldAccount,
  mdiWallFire,
  mdiWeb,
} from '@mdi/js';
import { TopologyNodeRole } from '../../../generated/caster-api';

/** A role someone can give a machine, what the picker calls it, and its icon. */
export interface TopologyRoleOption {
  role: TopologyNodeRole;
  label: string;
  path: string;
}

/**
 * The same Material Design Icons Caster uses everywhere else, as SVG paths
 * rather than the font: cytoscape draws on a canvas, which cannot use a font
 * icon but can draw an image.
 */
export const ROLE_OPTIONS: TopologyRoleOption[] = [
  { role: TopologyNodeRole.Server, label: 'Server', path: mdiServer },
  { role: TopologyNodeRole.Workstation, label: 'Workstation', path: mdiMonitor },
  {
    role: TopologyNodeRole.DomainController,
    label: 'Domain controller',
    path: mdiShieldAccount,
  },
  { role: TopologyNodeRole.Firewall, label: 'Firewall', path: mdiWallFire },
  { role: TopologyNodeRole.Router, label: 'Router', path: mdiRouterNetwork },
  { role: TopologyNodeRole.WebServer, label: 'Web server', path: mdiWeb },
  { role: TopologyNodeRole.Database, label: 'Database', path: mdiDatabase },
  { role: TopologyNodeRole.MailServer, label: 'Mail server', path: mdiEmailOutline },
  { role: TopologyNodeRole.Linux, label: 'Linux', path: mdiLinux },
  { role: TopologyNodeRole.Windows, label: 'Windows', path: mdiMicrosoftWindows },
  { role: TopologyNodeRole.Attacker, label: 'Attacker', path: mdiIncognito },
];

/** A machine nobody has given a role. */
export const MACHINE_ICON = mdiServer;
export const NETWORK_ICON = mdiLan;
export const EXTERNAL_NETWORK_ICON = mdiCloudOutline;

/**
 * An icon as an image cytoscape can draw, in one colour. Width and height are
 * set because Firefox will not draw an SVG image without them.
 */
export function iconImage(path: string, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<path fill="${color}" d="${path}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
