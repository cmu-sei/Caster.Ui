// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { Partition, Vlan, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VlanStore } from 'src/app/vlans/state/vlan/vlan.store';
import { PartitionComponent } from './partition.component';

@Component({ selector: 'cas-vlan-list', template: '', standalone: false })
class VlanListStub {
  @Input() showUnassigned: boolean;
  @Input() vlans: Vlan[];
  @Input() partitions: Partition[];
  @Input() canEdit: boolean;
}

const partition: Partition = {
  id: 'part1',
  name: 'Range',
  poolId: 'pool1',
  isDefault: false,
};

async function renderPartition(canEdit: boolean) {
  const vlansApi = {
    setDefaultPartition: vi.fn((_id: string) => of<unknown>(null)),
    addVlansToPartition: vi.fn((_id: string) => of<Vlan[]>([])),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(PartitionComponent, {
    declarations: [VlanListStub],
    imports: [
      MatExpansionModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatFormFieldModule,
      MatInputModule,
      ClipboardModule,
    ],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { partition, canEdit },
  });
  TestBed.inject(VlanStore).set([
    { id: 'v1', vlanId: 100, partitionId: 'part1', poolId: 'pool1' },
  ]);
  view.fixture.detectChanges();
  return { ...view, vlansApi, user: userEvent.setup() };
}

describe('PartitionComponent', () => {
  /**
   * Verifies: with canEdit the partition shows Edit Name, the VLAN amount controls and Delete, and Set Default calls the API.
   * Interacts with: VlansService.setDefaultPartition (stub), real PartitionService.
   * Data: partition Range (not default); canEdit true.
   */
  it('offers the partition controls when canEdit is true', async () => {
    const { vlansApi, user } = await renderPartition(true);

    expect(screen.getByRole('button', { name: 'Edit Name' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add VLANs' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove VLANs' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Set Default' }));

    expect(vlansApi.setDefaultPartition).toHaveBeenCalledWith('part1');
  });

  /**
   * Verifies: with canEdit, Add VLANs sends the typed amount for this partition.
   * Interacts with: VlansService.addVlansToPartition (stub), real VlanService.
   * Data: amount 5; canEdit true.
   */
  it('adds the typed number of VLANs when canEdit is true', async () => {
    const { vlansApi, user } = await renderPartition(true);

    const amount = screen.getByRole('spinbutton');
    await user.clear(amount);
    await user.type(amount, '5');
    await user.click(screen.getByRole('button', { name: 'Add VLANs' }));

    expect(vlansApi.addVlansToPartition).toHaveBeenCalledWith('part1', {
      vlans: '5',
    });
  });

  /**
   * Verifies: without canEdit the partition hides Edit Name, the VLAN amount controls and Delete, and Set Default does not call the API.
   * Interacts with: the canEdit checks in the template and in setDefault().
   * Data: partition Range; canEdit false.
   */
  it('shows the partition read-only when canEdit is false', async () => {
    const { vlansApi, user } = await renderPartition(false);

    expect(screen.getByText('Range')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Edit Name' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add VLANs' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set Default' }));
    expect(vlansApi.setDefaultPartition).not.toHaveBeenCalled();
  });

  /**
   * Verifies: expanding the panel passes the partition's VLANs and canEdit to the VLAN list, true and false.
   * Interacts with: the vlan-list stub's inputs; real VlanQuery.
   * Data: one VLAN 100 in part1; canEdit true, then false; the panel header clicked.
   */
  it.each([true, false])(
    'passes canEdit %s to the VLAN list',
    async (canEdit) => {
      const { fixture, user } = await renderPartition(canEdit);

      await user.click(screen.getByRole('button', { expanded: false }));

      const list: VlanListStub = fixture.debugElement.query(
        By.directive(VlanListStub),
      ).componentInstance;
      expect(list.vlans.map((v) => v.vlanId)).toEqual([100]);
      expect(list.canEdit).toBe(canEdit);
    },
  );
});
