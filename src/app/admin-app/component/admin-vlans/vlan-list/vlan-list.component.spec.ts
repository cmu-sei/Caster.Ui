// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Partition, Vlan, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
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

async function renderVlanList(
  canEdit: boolean,
  shownVlans: Vlan[] = vlans,
  showUnassigned = true,
  confirmAnswer = true,
) {
  const vlansApi = {
    partialEditVlan: vi.fn(
      (id: string, command: { reserved?: boolean; tag?: string }) =>
        of<Vlan>({ ...vlans[0], id, ...command }),
    ),
    acquireVlan: vi.fn(() => of<Vlan>({ ...vlans[0], inUse: true })),
  } satisfies ApiStub<VlansService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
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
    providers: [
      { provide: VlansService, useValue: vlansApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { vlans: shownVlans, partitions, canEdit, showUnassigned },
  });
  // The rows render inside a cdk-virtual-scroll-viewport, which computes its
  // rendered range after the first render; findByRole waits for them.
  const row = shownVlans.length
    ? ((await screen.findByRole('cell', { name: '100' })).closest(
        'tr',
      ) as HTMLElement)
    : undefined;
  return { ...view, vlansApi, confirm, row, user: userEvent.setup() };
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
    expect(
      within(row).getByRole('checkbox', { name: 'Select VLAN 100' }),
    ).toBeInTheDocument();
    const inUse = within(row).getByRole('checkbox', { name: 'In Use' });
    const reserved = within(row).getByRole('checkbox', { name: 'Reserved' });
    expect(inUse).toBeEnabled();
    expect(inUse).not.toBeChecked();
    expect(reserved).toBeEnabled();
    expect(reserved).not.toBeChecked();
    expect(within(row).getByRole('button', { name: 'Edit Tag' })).toBeVisible();
    expect(
      within(row).getByRole('button', {
        name: 'Remove VLAN from this Partition',
      }),
    ).toBeEnabled();
  });

  /**
   * Verifies: with canEdit, ticking Reserved reserves the VLAN through the API.
   * Interacts with: VlansService.partialEditVlan (stub), real VlanService.
   * Data: VLAN 100 not reserved; canEdit true.
   */
  it('reserves a VLAN when canEdit is true', async () => {
    const { vlansApi, row, user } = await renderVlanList(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');

    await user.click(within(row).getByRole('checkbox', { name: 'Reserved' }));

    expect(vlansApi.partialEditVlan).toHaveBeenCalledWith('v1', {
      reserved: true,
    });
    expect(snack).toHaveBeenCalledWith(
      'VLAN 100 is now reserved',
      'Dismiss',
      expect.anything(),
    );
  });

  /**
   * Verifies: when reserving fails the API's problem shows in a snack bar (not the error dialog) and the Reserved box goes back to unticked.
   * Interacts with: VlansService.partialEditVlan (stub throwing a 409 ProblemDetails), VlanFeedbackService, MatSnackBar (real, open spied).
   * Data: VLAN 100 not reserved; canEdit true.
   */
  it('shows why reserving failed and unticks Reserved', async () => {
    const { vlansApi, row, user } = await renderVlanList(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');
    vlansApi.partialEditVlan.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { title: 'Conflict', detail: 'VLAN 100 is in use.' },
          }),
      ),
    );
    const reserved = within(row).getByRole('checkbox', { name: 'Reserved' });

    await user.click(reserved);

    expect(snack).toHaveBeenCalledWith(
      'Could not reserve VLAN 100: Conflict VLAN 100 is in use.',
      'Dismiss',
      expect.anything(),
    );
    expect(reserved).not.toBeChecked();
  });

  /**
   * Verifies: Edit Tag then Enter saves the new tag through the API and says so.
   * Interacts with: VlansService.partialEditVlan (stub), VlanFeedbackService, MatSnackBar (real, open spied).
   * Data: VLAN 100 tagged web; new tag db; canEdit true.
   */
  it('saves an edited tag', async () => {
    const { vlansApi, row, user } = await renderVlanList(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');

    await user.click(within(row).getByRole('button', { name: 'Edit Tag' }));
    const tag = within(row).getByRole('textbox');
    await user.clear(tag);
    await user.type(tag, 'db{Enter}');

    expect(vlansApi.partialEditVlan).toHaveBeenCalledWith('v1', { tag: 'db' });
    expect(snack).toHaveBeenCalledWith(
      'Tagged VLAN 100 "db"',
      'Dismiss',
      expect.anything(),
    );
  });

  /**
   * Verifies: ticking In Use asks first, and cancelling leaves the box unticked and calls no API.
   * Interacts with: CrucibleDialogService.confirm (stub answering false), VlansService.acquireVlan (stub).
   * Data: VLAN 100 in partition part1, not in use; canEdit true.
   */
  it('puts In Use back when the confirm is cancelled', async () => {
    const { confirm, vlansApi, row, user } = await renderVlanList(
      true,
      vlans,
      true,
      false,
    );
    const inUse = within(row).getByRole('checkbox', { name: 'In Use' });
    await user.click(inUse);

    expect(confirm).toHaveBeenCalled();
    expect(inUse).not.toBeChecked();
    expect(vlansApi.acquireVlan).not.toHaveBeenCalled();
  });

  /**
   * Verifies: ticking In Use and confirming acquires the VLAN through the API.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), VlansService.acquireVlan (stub), real VlanService.
   * Data: VLAN 100 in partition part1, not in use; canEdit true.
   */
  it('acquires a VLAN when In Use is ticked and confirmed', async () => {
    const { vlansApi, row, user } = await renderVlanList(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');
    await user.click(within(row).getByRole('checkbox', { name: 'In Use' }));

    expect(vlansApi.acquireVlan).toHaveBeenCalledWith({
      partitionId: 'part1',
      vlanId: 100,
    });
    expect(snack).toHaveBeenCalledWith(
      'VLAN 100 is now in use',
      'Dismiss',
      expect.anything(),
    );
  });

  /**
   * Verifies: without canEdit the selection menu, In Use and Reserved checkboxes are disabled, and no checkbox, Edit Tag or Remove control renders.
   * Interacts with: the canEdit bindings and recalculateDisplayedColumns().
   * Data: VLAN 100 in partition part1; canEdit false.
   */
  it('shows the VLANs read-only when canEdit is false', async () => {
    const { row } = await renderVlanList(false);

    expect(screen.getByRole('button', { name: '0 Selected' })).toBeDisabled();
    expect(
      within(row).queryByRole('checkbox', { name: /^Select/ }),
    ).not.toBeInTheDocument();
    expect(
      within(row).getByRole('checkbox', { name: 'In Use' }),
    ).toBeDisabled();
    expect(
      within(row).getByRole('checkbox', { name: 'Reserved' }),
    ).toBeDisabled();
    expect(
      within(row).queryByRole('button', { name: 'Edit Tag' }),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByRole('button', {
        name: 'Remove VLAN from this Partition',
      }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: the column headers read ID / In Use / Reserved / Tag with a blank actions header, as on the other admin tables, each header and the selection menu explain themselves in a tooltip, and select-all is named.
   * Interacts with: the header row of the VLAN table.
   * Data: VLAN 100; canEdit true.
   */
  it('labels the columns like the other admin tables', async () => {
    await renderVlanList(true);
    const headerTip = (name: string) =>
      screen.getByRole('columnheader', { name: new RegExp(`^${name}`) });

    expect(headerTip('ID')).toHaveAccessibleDescription(
      'The VLAN number, 0–4095',
    );
    expect(headerTip('In Use')).toHaveAccessibleDescription(
      'Handed out to a Terraform run; released when the run is destroyed',
    );
    expect(headerTip('Reserved')).toHaveAccessibleDescription(
      'Never handed out by Caster',
    );
    expect(headerTip('Tag')).toHaveAccessibleDescription(
      'A label Terraform can ask for by name',
    );
    expect(
      screen.getByRole('button', { name: '0 Selected' }),
    ).toHaveAccessibleDescription('Actions for the selected VLANs');
    expect(
      screen.getByRole('checkbox', { name: 'Select all VLANs' }),
    ).toBeInTheDocument();

    const headers = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent.trim());
    expect(headers).toEqual(['', 'ID', 'In Use', 'Reserved', 'Tag', '']);
  });

  /**
   * Verifies: an empty partition says it has no VLANs (not 'No data matching the filter ""'), across every column.
   * Interacts with: the matNoDataRow, showUnassigned and displayedColumns.
   * Data: no VLANs; showUnassigned true (a partition's list); canEdit true.
   */
  it('says an empty partition has no VLANs', async () => {
    await renderVlanList(true, [], true);

    const cell = await screen.findByText(
      'This Partition currently has no VLANs',
    );
    expect(cell).toHaveAttribute('colspan', '6');
    expect(screen.queryByText(/No data matching/)).not.toBeInTheDocument();
  });

  /**
   * Verifies: the Unassigned list says there are no unassigned VLANs when empty.
   * Interacts with: the matNoDataRow and showUnassigned.
   * Data: no VLANs; showUnassigned false (the Unassigned panel); canEdit false.
   */
  it('says when there are no unassigned VLANs', async () => {
    await renderVlanList(false, [], false);

    const cell = await screen.findByText(
      'There are currently no unassigned VLANs',
    );
    expect(cell).toHaveAttribute('colspan', '4');
  });

  /**
   * Verifies: the ID header sorts the VLANs, and the search field (placeholder Search, as on the other admin lists) filters them and clears.
   * Interacts with: MatSort on the data source, filterControl (debounced 500 ms) and filterPredicate, Clear.
   * Data: VLANs 100 (tag web) and 200 (tag db); canEdit false; search "db".
   */
  it('sorts by ID and filters by tag', async () => {
    await renderVlanList(false, [
      vlans[0],
      { ...vlans[0], id: 'v2', vlanId: 200, tag: 'db' },
    ]);
    const user = userEvent.setup();
    const ids = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getAllByRole('cell')[0].textContent.trim());

    expect(ids()).toEqual(['100', '200']);
    await user.click(screen.getByRole('button', { name: 'ID' }));
    await user.click(screen.getByRole('button', { name: 'ID' }));
    expect(ids()).toEqual(['200', '100']);

    await user.type(screen.getByPlaceholderText('Search'), 'db');
    await vi.waitFor(() => expect(ids()).toEqual(['200']), { timeout: 2000 });

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await vi.waitFor(() => expect(ids()).toEqual(['200', '100']), {
      timeout: 2000,
    });
  });
});
