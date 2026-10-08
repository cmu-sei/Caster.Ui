// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Partition, Vlan, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VlanListComponent } from './vlan-list.component';

const vlans: Vlan[] = [
  {
    id: 'v1',
    vlanId: 100,
    partitionId: 'part1',
    poolId: 'pool1',
    inUse: false,
    reserved: false,
    reservedEditable: true,
    tag: 'web',
  },
];
const partitions: Partition[] = [{ id: 'part2', name: 'Red', poolId: 'pool1' }];

async function renderVlanList(canEdit: boolean) {
  const vlansApi = {
    partialEditVlan: vi.fn((id: string, command: { reserved?: boolean }) =>
      of<Vlan>({ ...vlans[0], id, ...command }),
    ),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(VlanListComponent, {
    imports: [
      ScrollingModule,
      MatTableModule,
      MatSortModule,
      MatCheckboxModule,
      MatButtonModule,
      MatIconModule,
      MatMenuModule,
      MatTooltipModule,
      MatFormFieldModule,
      MatInputModule,
    ],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { vlans, partitions, canEdit },
  });
  // The rows render inside a cdk-virtual-scroll-viewport, which computes its
  // rendered range after the first render; findByRole waits for them.
  const row = (await screen.findByRole('cell', { name: '100' })).closest(
    'tr',
  ) as HTMLElement;
  return { ...view, vlansApi, row, user: userEvent.setup() };
}

describe('VlanListComponent', () => {
  /**
   * Verifies: with canEdit the selection menu, row checkboxes, In Use, Reserved, Edit Tag and Remove controls are all available.
   * Interacts with: the canEdit bindings and the select/actions columns.
   * Data: VLAN 100 in partition part1, reservation editable; canEdit true.
   */
  it('offers the VLAN controls when canEdit is true', async () => {
    const { row } = await renderVlanList(true);

    expect(screen.getByRole('button', { name: '0 Selected' })).toBeEnabled();
    expect(within(row).getByRole('checkbox')).toBeInTheDocument();
    const [inUse, reserved] = within(row).getAllByRole('button', {
      name: 'false',
    });
    expect(inUse).toBeEnabled();
    expect(reserved).toBeEnabled();
    expect(within(row).getByRole('button', { name: 'Edit Tag' })).toBeVisible();
    expect(
      within(row).getByRole('button', {
        name: 'Remove VLAN from this Partition',
      }),
    ).toBeEnabled();
  });

  /**
   * Verifies: with canEdit, clicking Reserved reserves the VLAN through the API.
   * Interacts with: VlansService.partialEditVlan (stub), real VlanService.
   * Data: VLAN 100 not reserved; canEdit true.
   */
  it('reserves a VLAN when canEdit is true', async () => {
    const { vlansApi, row, user } = await renderVlanList(true);

    const [, reservedButton] = within(row).getAllByRole('button', {
      name: 'false',
    });
    await user.click(reservedButton);

    expect(vlansApi.partialEditVlan).toHaveBeenCalledWith('v1', {
      reserved: true,
    });
  });

  /**
   * Verifies: without canEdit the selection menu, In Use and Reserved buttons are disabled, and no checkbox, Edit Tag or Remove control renders.
   * Interacts with: the canEdit bindings and recalculateDisplayedColumns().
   * Data: VLAN 100 in partition part1; canEdit false.
   */
  it('shows the VLANs read-only when canEdit is false', async () => {
    const { row } = await renderVlanList(false);

    expect(screen.getByRole('button', { name: '0 Selected' })).toBeDisabled();
    expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument();
    for (const toggle of within(row).getAllByRole('button', {
      name: 'false',
    })) {
      expect(toggle).toBeDisabled();
    }
    expect(
      within(row).queryByRole('button', { name: 'Edit Tag' }),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByRole('button', {
        name: 'Remove VLAN from this Partition',
      }),
    ).not.toBeInTheDocument();
  });
});
