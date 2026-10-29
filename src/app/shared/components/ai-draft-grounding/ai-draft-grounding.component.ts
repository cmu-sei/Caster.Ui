/*
Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import {
  AiInventoryGrounding,
  AiInventoryKind,
  AiInventoryReference,
  AiMachineRole,
  AiSegmentRole,
  AiTopologyMachine,
  AiTopologyPlan,
} from 'src/app/generated/caster-api';

const SEGMENT_ROLES: Record<AiSegmentRole, string> = {
  Other: 'Other',
  Internet: 'Internet',
  Perimeter: 'Perimeter',
  Dmz: 'DMZ',
  UserLan: 'User LAN',
  Server: 'Server',
  Management: 'Management',
  Ot: 'OT/ICS',
  Attacker: 'Attacker',
};

const MACHINE_ROLES: Record<AiMachineRole, string> = {
  Attacker: 'Attacker',
  ParticipantWorkstation: 'Participant workstation',
  Workstation: 'Workstation',
  Server: 'Server',
  NetworkDevice: 'Network device',
  SecurityTool: 'Security tool',
  Ot: 'OT/ICS',
  Other: 'Other',
};

const KINDS: Record<AiInventoryKind, string> = {
  Template: 'Template',
  Network: 'Network',
  Datastore: 'Datastore',
};

/** The viewer's local time with its zone, e.g. "Oct 29, 2:05 PM EDT". */
export function readAt(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * What an AI draft was checked against before review: the infrastructure inventory it was grounded in, with
 * the names it found there and the ones it did not, and the topology the model says the draft builds.
 * Shared by the Terraform and Design draft dialogs; it shows, and changes nothing.
 */
@Component({
  selector: 'cas-ai-draft-grounding',
  templateUrl: './ai-draft-grounding.component.html',
  styleUrls: ['./ai-draft-grounding.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatIcon],
})
export class AiDraftGroundingComponent {
  readonly inventory = input<AiInventoryGrounding | null | undefined>(undefined);
  readonly topology = input<AiTopologyPlan | null | undefined>(undefined);

  /** e.g. 'the Proxmox inventory "default", read Oct 29, 2:05 PM EDT' */
  readonly checkedAgainst = computed(() =>
    (this.inventory()?.connections ?? [])
      .map((c) => {
        const read = readAt(c.lastUpdated);
        return `the ${c.hypervisor} inventory "${c.name}"${read ? `, read ${read}` : ''}`;
      })
      .join(' and ')
  );

  readonly stale = computed(() => (this.inventory()?.connections ?? []).some((c) => c.stale));

  readonly found = computed(() => this.groupByKind(this.inventory()?.found));
  readonly unknown = computed(() => this.inventory()?.unknown ?? []);

  readonly planTitle = computed(() => {
    const plan = this.topology();
    const segments = plan?.segments?.length ?? 0;
    const machines = plan?.machines?.length ?? 0;
    return `Topology plan: ${segments} ${segments === 1 ? 'segment' : 'segments'}, ${machines} ${machines === 1 ? 'machine' : 'machines'}`;
  });

  readonly totals = computed(() => {
    const t = this.topology()?.totals;
    if (!t || !t.machines) return '';
    const sized = t.sized === t.machines ? '' : ` (${t.sized} of ${t.machines} sized)`;
    const free = t.datastoreFreeGiB != null ? `; ${t.datastoreFreeGiB} GiB free on the datastores` : '';
    return `${t.cpu} vCPU, ${this.gib(t.memoryMiB)} GiB memory, ${t.diskGiB} GiB disk${sized}${free}`;
  });

  segmentRole(role: AiSegmentRole | undefined): string {
    return SEGMENT_ROLES[role ?? 'Other'] ?? role;
  }

  machineRole(role: AiMachineRole | undefined): string {
    return MACHINE_ROLES[role ?? 'Other'] ?? role;
  }

  kind(kind: AiInventoryKind | undefined): string {
    return KINDS[kind ?? 'Template'] ?? kind;
  }

  interfaces(machine: AiTopologyMachine): string {
    return (machine.interfaces ?? []).map((i) => (i.address ? `${i.segment} ${i.address}` : i.segment)).join(', ');
  }

  size(machine: AiTopologyMachine): string {
    const parts = [
      machine.cpu ? `${machine.cpu} vCPU` : '',
      machine.memoryMiB ? `${this.gib(machine.memoryMiB)} GiB` : '',
      machine.diskGiB ? `${machine.diskGiB} GiB disk` : '',
    ];
    return parts.filter((p) => p).join(', ');
  }

  private gib(mib: number | null | undefined): string {
    return (Math.round(((mib ?? 0) / 1024) * 10) / 10).toString();
  }

  private groupByKind(refs: AiInventoryReference[] | null | undefined): { kind: string; names: string }[] {
    const groups = new Map<string, string[]>();
    for (const ref of refs ?? []) {
      const label = this.kind(ref.kind);
      groups.set(label, [...(groups.get(label) ?? []), ref.name]);
    }
    return [...groups].map(([kind, names]) => ({ kind, names: names.join(', ') }));
  }
}
