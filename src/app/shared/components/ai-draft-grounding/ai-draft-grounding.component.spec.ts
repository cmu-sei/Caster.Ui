// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AiInventoryGrounding, AiTopologyPlan } from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AiDraftGroundingComponent, readAt } from './ai-draft-grounding.component';

const READ = '2026-10-29T14:05:00Z';

// a Proxmox inventory that has the template and one network, but not the DMZ bridge
const CHECKED: AiInventoryGrounding = {
  checked: true,
  connections: [{ name: 'default', hypervisor: 'Proxmox', lastUpdated: READ, stale: false, unavailable: [], truncated: false }],
  found: [
    { kind: 'Template', name: '9000', where: 'web.tf', connection: 'default' },
    { kind: 'Network', name: 'vmbr0', where: 'web.tf', connection: 'default' },
    { kind: 'Network', name: 'corp', where: 'topology segment corp', connection: 'default' },
  ],
  unknown: [{ kind: 'Network', name: 'dmz', where: 'web.tf proxmox_virtual_environment_vm.web' }],
};

const PLAN: AiTopologyPlan = {
  segments: [
    { name: 'internet', role: 'Internet', cidr: '203.0.113.0/24' },
    { name: 'dmz', role: 'Dmz', cidr: '10.0.10.0/24', vlanId: 10, network: 'dmz', keyTerrain: true },
  ],
  machines: [
    { name: 'kali', role: 'Attacker', interfaces: [{ segment: 'internet', address: '203.0.113.9' }] },
    { name: 'web', role: 'Server', template: '9000', cpu: 2, memoryMiB: 4096, diskGiB: 32, critical: true, interfaces: [{ segment: 'dmz', address: '10.0.10.10' }] },
    { name: 'blue-1', role: 'ParticipantWorkstation', team: 'Blue', interfaces: [{ segment: 'dmz' }] },
  ],
  attackPath: [{ from: 'kali', to: 'web', technique: 'T1190', description: 'Exploits the web server' }],
  totals: { machines: 3, sized: 1, cpu: 2, memoryMiB: 4096, diskGiB: 32, datastoreFreeGiB: 100 },
};

async function renderGrounding(inventory?: AiInventoryGrounding, topology?: AiTopologyPlan) {
  const view = await renderComponent(AiDraftGroundingComponent, { inputs: { inventory, topology } });
  return { ...view, user: userEvent.setup() };
}

describe('AiDraftGroundingComponent', () => {
  /**
   * Verifies: a checked draft says which inventory and when it was read, groups the names it found by kind,
   * and lists each name it did not find with where the draft uses it.
   * Interacts with: the inventory input.
   * Data: CHECKED, read 2026-10-29 14:05 UTC.
   */
  it('shows what the draft found in the inventory and what it did not', async () => {
    await renderGrounding(CHECKED);

    expect(screen.getByRole('heading', { name: 'Infrastructure inventory' })).toBeInTheDocument();
    expect(screen.getByText(`Checked against the Proxmox inventory "default", read ${readAt(READ)}.`)).toBeInTheDocument();
    const found = screen.getByLabelText('In the inventory');
    expect(within(found).getByText('Template')).toBeInTheDocument();
    expect(within(found).getByText('9000')).toBeInTheDocument();
    expect(within(found).getByText('vmbr0, corp')).toBeInTheDocument();
    const unknown = screen.getByRole('list', { name: 'Not in the inventory' });
    expect(unknown).toHaveTextContent('Network dmz is not in the inventory (web.tf proxmox_virtual_environment_vm.web)');
  });

  /**
   * Verifies: a draft that was not checked says why, in the API's words, and lists nothing as found or unknown.
   * Interacts with: the inventory input.
   * Data: unchecked for want of ViewHosts.
   */
  it('says why the draft was not checked', async () => {
    await renderGrounding({ checked: false, reason: 'Not checked against the infrastructure inventory: listing it needs the ViewHosts permission.', connections: [], found: [], unknown: [] });

    expect(screen.getByText('Not checked against the infrastructure inventory: listing it needs the ViewHosts permission.')).toBeInTheDocument();
    expect(screen.queryByLabelText('In the inventory')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Not in the inventory' })).not.toBeInTheDocument();
  });

  /**
   * Verifies: a stale read is called out, and what could not be read is shown.
   * Interacts with: the inventory input.
   * Data: a stale connection whose datastores could not be read.
   */
  it('says when part of the inventory is out of date', async () => {
    await renderGrounding({
      ...CHECKED,
      reason: 'Datastores of default could not be read: permission denied',
      connections: [{ ...CHECKED.connections[0], stale: true, unavailable: ['Datastore'] }],
    });

    expect(screen.getByText(/Some of it is from an earlier read and may be out of date\./)).toBeInTheDocument();
    expect(screen.getByText('Datastores of default could not be read: permission denied')).toBeInTheDocument();
  });

  /**
   * Verifies: the topology plan lists its segments and machines with readable roles and marks, the attack path
   * in order, and the totals with the free space they are measured against.
   * Interacts with: the topology input, the plan's expansion panel.
   * Data: PLAN, an internet and a DMZ segment, an attacker, a critical web server and a Blue workstation.
   */
  it('lists the topology plan', async () => {
    const { user } = await renderGrounding(undefined, PLAN);

    await user.click(screen.getByText('Topology plan: 2 segments, 3 machines'));

    const segments = screen.getByRole('table', { name: 'Segments' });
    expect(within(segments).getByText('DMZ')).toBeInTheDocument();
    expect(within(segments).getByText('Key terrain')).toBeInTheDocument();
    expect(within(segments).getByText('10.0.10.0/24')).toBeInTheDocument();
    const machines = screen.getByRole('table', { name: 'Machines' });
    expect(within(machines).getByText('Critical')).toBeInTheDocument();
    expect(within(machines).getByText('Participant workstation (Blue)')).toBeInTheDocument();
    expect(within(machines).getByText('dmz 10.0.10.10')).toBeInTheDocument();
    expect(within(machines).getByText('2 vCPU, 4 GiB, 32 GiB disk')).toBeInTheDocument();
    expect(screen.getByText('kali to web (T1190): Exploits the web server')).toBeInTheDocument();
    expect(screen.getByText('In all: 2 vCPU, 4 GiB memory, 32 GiB disk (1 of 3 sized); 100 GiB free on the datastores.')).toBeInTheDocument();
  });

  /**
   * Verifies: with neither an inventory nor a plan, nothing is shown.
   * Interacts with: both inputs.
   * Data: none.
   */
  it('shows nothing for a draft with neither', async () => {
    const { container } = await renderGrounding();

    expect(container.textContent.trim()).toBe('');
  });
});
