// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Partition, Vlan, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PartitionListComponent } from './partition-list.component';
import { PartitionComponent } from 'src/app/admin-app/component/admin-vlans/partition/partition.component';
import { VlanListComponent } from 'src/app/admin-app/component/admin-vlans/vlan-list/vlan-list.component';

@Component({ selector: 'cas-partition', template: '' })
class PartitionStub {
  readonly partition = input<Partition>(undefined);
  readonly canEdit = input<boolean>(undefined);
}

@Component({ selector: 'cas-vlan-list', template: '' })
class VlanListStub {
  readonly vlans = input<Vlan[]>(undefined);
  readonly partitions = input<Partition[]>(undefined);
  readonly showUnassigned = input<boolean>(undefined);
  readonly canEdit = input<boolean>(undefined);
}

const unassignedVlans: Vlan[] = [
  { id: 'v1', vlanId: 1, poolId: 'pool1', partitionId: null },
  { id: 'v2', vlanId: 2, poolId: 'pool1', partitionId: null },
  { id: 'v3', vlanId: 3, poolId: 'pool1', partitionId: 'part1' },
];

async function renderPartitionList(
  canEdit: boolean,
  poolVlans: Vlan[] = unassignedVlans,
) {
  const vlansApi = {
    getVlansByPool: vi.fn((_id: string) => of<Vlan[]>(poolVlans)),
    getPartitionsByPool: vi.fn((poolId: string) =>
      of<Partition[]>([{ id: 'part1', name: 'Range', poolId }]),
    ),
    createPartition: vi.fn((poolId: string) =>
      of<Partition>({ id: 'part2', name: 'New Partition', poolId }),
    ),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(PartitionListComponent, {
    childStubs: [
      { replace: PartitionComponent, with: PartitionStub },
      { replace: VlanListComponent, with: VlanListStub },
    ],
    imports: [
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatExpansionModule,
    ],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { poolId: 'pool1', canEdit },
  });
  const partitions = (): PartitionStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(PartitionStub))
      .map((d) => d.componentInstance);
  const vlanList = (): VlanListStub | undefined =>
    view.fixture.debugElement.query(By.directive(VlanListStub))
      ?.componentInstance;
  return { ...view, vlansApi, partitions, vlanList, user: userEvent.setup() };
}

describe('PartitionListComponent', () => {
  /**
   * Verifies: the pool's VLANs and partitions load, one item per partition renders with canEdit true (no Unassigned panel), and Add New Partition creates one.
   * Interacts with: VlansService.getVlansByPool, getPartitionsByPool and createPartition (stubs), real PartitionService and PartitionQuery.
   * Data: pool pool1 with partition Range; canEdit true.
   */
  it('lists and creates partitions when canEdit is true', async () => {
    const { vlansApi, partitions, user } = await renderPartitionList(true);

    expect(vlansApi.getVlansByPool).toHaveBeenCalledWith('pool1');
    expect(partitions().map((p) => p.partition()?.id)).toEqual(['part1']);
    expect(partitions().map((p) => p.canEdit())).toEqual([true]);

    await user.click(screen.getByRole('button', { name: 'Add New Partition' }));
    expect(vlansApi.createPartition).toHaveBeenCalledWith('pool1', {
      name: 'New Partition',
    });
  });

  /**
   * Verifies: without canEdit Add New Partition is disabled (as Add on the other admin pages) and every partition item gets canEdit false.
   * Interacts with: the [disabled]="!canEdit" binding, the partition stubs' canEdit inputs.
   * Data: pool pool1 with partition Range; canEdit false.
   */
  it('disables Add New Partition when canEdit is false', async () => {
    const { vlansApi, partitions } = await renderPartitionList(false);

    expect(
      screen.getByRole('button', { name: 'Add New Partition' }),
    ).toBeDisabled();
    expect(partitions().map((p) => p.canEdit())).toEqual([false]);
    expect(vlansApi.createPartition).not.toHaveBeenCalled();
  });

  /**
   * Verifies: VLANs outside every partition show as a plain line (not a partition panel), and Show/Hide reveals and hides their VLAN list with the pool's partitions to reassign to.
   * Interacts with: VlanQuery.selectUnassignedByPoolId, showUnassigned, the vlan-list stub.
   * Data: pool pool1 with VLANs 1 and 2 unassigned and 3 in Range; canEdit true.
   */
  it('shows the unassigned VLANs on request', async () => {
    const { vlanList, user } = await renderPartitionList(true);

    expect(
      screen.getByText("2 VLANs aren't in any partition"),
    ).toBeVisible();
    expect(vlanList()).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(vlanList()?.vlans().map((v) => v.vlanId)).toEqual([1, 2]);
    expect(vlanList()?.partitions().map((p) => p.id)).toEqual(['part1']);
    expect(vlanList()?.showUnassigned()).toBe(false);
    expect(vlanList()?.canEdit()).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(vlanList()).toBeUndefined();
  });

  /**
   * Verifies: when every VLAN is in a partition the line says so and offers no Show button.
   * Interacts with: VlanQuery.selectUnassignedByPoolId.
   * Data: pool pool1 with VLAN 3 in Range only; canEdit false.
   */
  it('says when every VLAN is in a partition', async () => {
    await renderPartitionList(false, [unassignedVlans[2]]);

    expect(
      screen.getByText('Every VLAN in this Pool is in a partition'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Show' }),
    ).not.toBeInTheDocument();
  });
});
