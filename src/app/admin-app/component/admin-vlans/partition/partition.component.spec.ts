// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ClipboardModule } from 'ngx-clipboard';
import { Partition, Vlan, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VlanStore } from 'src/app/vlans/state/vlan/vlan.store';
import { PartitionComponent } from './partition.component';
import { VlanListComponent } from 'src/app/admin-app/component/admin-vlans/vlan-list/vlan-list.component';

@Component({ selector: 'cas-vlan-list', template: '' })
class VlanListStub {
  readonly showUnassigned = input<boolean>(undefined);
  readonly vlans = input<Vlan[]>(undefined);
  readonly partitions = input<Partition[]>(undefined);
  readonly canEdit = input<boolean>(undefined);
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
    addVlansToPartition: vi.fn((_id: string, command: { vlans?: number }) =>
      of<Vlan[]>(
        Array.from({ length: command.vlans }, (_, i) => ({ id: `n${i}` })),
      ),
    ),
    removeVlansFromPartition: vi.fn(
      (_id: string, command: { vlans?: number }) =>
        of<Vlan[]>(
          Array.from({ length: command.vlans }, (_, i) => ({ id: `r${i}` })),
        ),
    ),
    partialEditPartition: vi.fn((id: string, command: { name?: string }) =>
      of<Partition>({ ...partition, id, name: command.name }),
    ),
  } satisfies ApiStub<VlansService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(false);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(PartitionComponent, {
    childStubs: [{ replace: VlanListComponent, with: VlanListStub }],
    imports: [
      MatExpansionModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatFormFieldModule,
      MatInputModule,
      ClipboardModule,
      MatDialogModule,
    ],
    providers: [
      { provide: VlansService, useValue: vlansApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { partition, canEdit },
  });
  TestBed.inject(VlanStore).set([
    { id: 'v1', vlanId: 100, partitionId: 'part1', poolId: 'pool1' },
  ]);
  view.fixture.detectChanges();
  return { ...view, vlansApi, confirm, user: userEvent.setup() };
}

describe('PartitionComponent', () => {
  /**
   * Verifies: with canEdit the partition shows Rename, the VLAN amount controls and Delete, and Set Default calls the API and says so in a snack bar.
   * Interacts with: VlansService.setDefaultPartition (stub), real PartitionService.
   * Data: partition Range (not default); canEdit true.
   */
  it('offers the partition controls when canEdit is true', async () => {
    const { vlansApi, user } = await renderPartition(true);

    expect(screen.getByRole('button', { name: 'Rename' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add VLANs' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove VLANs' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete Range' })).toBeVisible();
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');
    await user.click(screen.getByRole('button', { name: 'Set Default' }));

    expect(vlansApi.setDefaultPartition).toHaveBeenCalledWith('part1');
    expect(snack).toHaveBeenCalledWith(
      'Range is now the default partition',
      'Dismiss',
      expect.anything(),
    );
  });

  /**
   * Verifies: Delete Range asks "Delete Partition" / "Are you sure that you want to delete <name>?" with a Delete button.
   * Interacts with: CrucibleDialogService.confirm (stub answering false).
   * Data: partition Range; canEdit true.
   */
  it('confirms a delete with the standard wording', async () => {
    const { confirm, user } = await renderPartition(true);

    await user.click(screen.getByRole('button', { name: 'Delete Range' }));

    expect(confirm).toHaveBeenCalledWith({
      title: 'Delete Partition',
      message: 'Are you sure that you want to delete Range?',
      confirmText: 'Delete',
    });
  });

  /**
   * Verifies: Rename opens the shared name dialog titled "Rename <name>", and Save renames the partition through the API with a snack bar.
   * Interacts with: the real MatDialog and NameDialogComponent, VlansService.partialEditPartition (stub), real PartitionService.
   * Data: partition Range; canEdit true; new name Core.
   */
  it('renames the partition through the name dialog', async () => {
    const { vlansApi, user } = await renderPartition(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(
      await screen.findByRole('heading', { name: 'Rename Range' }),
    ).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Core');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(vlansApi.partialEditPartition).toHaveBeenCalledWith('part1', {
      name: 'Core',
    });
    expect(snack).toHaveBeenCalledWith(
      'Renamed Range to Core',
      'Dismiss',
      expect.anything(),
    );
  });

  /**
   * Verifies: with canEdit, Add VLANs sends the typed amount as a number for this partition then clears the field and says how many were added.
   * Interacts with: VlansService.addVlansToPartition (stub), real VlanService.
   * Data: amount 5; canEdit true.
   */
  it('adds the typed number of VLANs when canEdit is true', async () => {
    const { vlansApi, user } = await renderPartition(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');

    const amount = screen.getByRole('spinbutton', {
      name: 'Number of VLANs to add or remove',
    });
    await user.type(amount, '5');
    await user.click(screen.getByRole('button', { name: 'Add VLANs' }));

    expect(vlansApi.addVlansToPartition).toHaveBeenCalledWith('part1', {
      vlans: 5,
    });
    expect(amount).toHaveValue(null);
    expect(snack).toHaveBeenCalledWith(
      'Added 5 VLANs to Range',
      'Dismiss',
      expect.anything(),
    );
    expect(screen.getByRole('button', { name: 'Add VLANs' })).toBeDisabled();
  });

  /**
   * Verifies: Remove VLANs sends the typed amount as a number for this partition and says how many were removed.
   * Interacts with: VlansService.removeVlansFromPartition (stub), real VlanService.
   * Data: amount 3; canEdit true.
   */
  it('removes the typed number of VLANs', async () => {
    const { vlansApi, user } = await renderPartition(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');

    await user.type(screen.getByRole('spinbutton'), '3');
    await user.click(screen.getByRole('button', { name: 'Remove VLANs' }));

    expect(vlansApi.removeVlansFromPartition).toHaveBeenCalledWith('part1', {
      vlans: 3,
    });
    expect(snack).toHaveBeenCalledWith(
      'Removed 3 VLANs from Range',
      'Dismiss',
      expect.anything(),
    );
  });

  /**
   * Verifies: when adding fails the API's problem shows in a snack bar (not the error dialog) and the typed amount stays.
   * Interacts with: VlansService.addVlansToPartition (stub throwing a 400 ProblemDetails), VlanFeedbackService, MatSnackBar (real, open spied).
   * Data: amount 9; the API answers 400 "Not enough VLANs".
   */
  it('shows why adding VLANs failed', async () => {
    const { vlansApi, user } = await renderPartition(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');
    vlansApi.addVlansToPartition.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { title: 'Bad Request', detail: 'Not enough VLANs.' },
          }),
      ),
    );
    const amount = screen.getByRole('spinbutton');

    await user.type(amount, '9');
    await user.click(screen.getByRole('button', { name: 'Add VLANs' }));

    expect(snack).toHaveBeenCalledWith(
      'Could not add VLANs to Range: Bad Request Not enough VLANs.',
      'Dismiss',
      expect.anything(),
    );
    expect(amount).toHaveValue(9);
  });

  /**
   * Verifies: Add and Remove VLANs stay disabled for a blank, zero, negative, fractional or too large amount, so nothing is sent.
   * Interacts with: setAmount() and the [disabled]="!amount()" bindings.
   * Data: amounts "", 0, -2, 1.5 and 5000; canEdit true.
   */
  it.each(['', '0', '-2', '1.5', '5000'])(
    'refuses the amount "%s"',
    async (typed) => {
      const { vlansApi, user } = await renderPartition(true);
      const amount = screen.getByRole('spinbutton');

      if (typed) {
        await user.type(amount, typed);
      }
      expect(screen.getByRole('button', { name: 'Add VLANs' })).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Remove VLANs' }),
      ).toBeDisabled();
      expect(vlansApi.addVlansToPartition).not.toHaveBeenCalled();
    },
  );

  /**
   * Verifies: typing in the amount field (including space and Enter) and clicking it or the action area around the disabled buttons leave the panel closed.
   * Interacts with: the stopPropagation on the header's action area, MatExpansionPanelHeader's click and keydown toggles.
   * Data: partition Range; canEdit true; keys "2", space, Enter.
   */
  it('keeps the panel closed while the amount is used', async () => {
    const { user } = await renderPartition(true);
    const header = screen.getByRole('button', { expanded: false });
    const amount = screen.getByRole('spinbutton');

    await user.click(amount);
    await user.type(amount, '2 {Enter}');
    await user.clear(amount);
    // A disabled button passes the click to its parent, the action area.
    await user.click(amount.closest('.action-buttons') as HTMLElement);

    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * Verifies: without canEdit the partition hides Rename, the VLAN amount controls and Delete, and Set Default does not call the API.
   * Interacts with: the canEdit checks in the template and in setDefault().
   * Data: partition Range; canEdit false.
   */
  it('shows the partition read-only when canEdit is false', async () => {
    const { vlansApi, user } = await renderPartition(false);

    expect(screen.getByText('Range')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Rename' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add VLANs' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Range' }),
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
      expect(list.vlans().map((v) => v.vlanId)).toEqual([100]);
      expect(list.canEdit()).toBe(canEdit);
    },
  );
});
