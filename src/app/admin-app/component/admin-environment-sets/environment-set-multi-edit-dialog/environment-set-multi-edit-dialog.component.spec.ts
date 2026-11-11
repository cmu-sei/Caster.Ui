// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  EnvironmentSet,
  EnvironmentSetsService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { EnvironmentSetMultiEditDialogComponent } from './environment-set-multi-edit-dialog.component';

const sets: EnvironmentSet[] = [
  {
    id: 'a',
    name: 'A',
    entries: [
      {
        id: 'a1',
        kind: 'EnvironmentVariable',
        targetName: 'REGION',
        valueSource: 'Plain',
        value: 'east',
      },
      {
        id: 'a2',
        kind: 'EnvironmentVariable',
        targetName: 'OLD',
        valueSource: 'Plain',
        value: 'x',
      },
    ],
  },
  {
    id: 'b',
    name: 'B',
    entries: [
      {
        id: 'b1',
        kind: 'EnvironmentVariable',
        targetName: 'REGION',
        valueSource: 'Plain',
        value: 'west',
      },
    ],
  },
];

/** REGION in A and B with different values, and nothing in C. */
const threeSets: EnvironmentSet[] = [
  ...sets,
  { id: 'c', name: 'C', entries: [] },
];

async function renderDialog(
  entryDialogResult: unknown = undefined,
  selected: EnvironmentSet[] = sets,
  canUseConnections = false,
) {
  const { dialogRef, close } =
    dialogRefStub<EnvironmentSetMultiEditDialogComponent>();
  const api = {
    batchEditEnvironmentSets: vi.fn(() => of<EnvironmentSet[]>(sets)),
  } satisfies ApiStub<EnvironmentSetsService>;
  const open = vi.fn(() => ({ afterClosed: () => of(entryDialogResult) }));

  const view = await renderComponent(EnvironmentSetMultiEditDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          sets: selected,
          secrets: null,
          connections: [],
          canUseConnections,
        },
      },
      { provide: EnvironmentSetsService, useValue: api },
      { provide: MatDialog, useValue: { open } },
    ],
  });

  return { ...view, api, close, open, user: userEvent.setup() };
}

describe('EnvironmentSetMultiEditDialogComponent', () => {
  /**
   * Verifies: one row per entry name, with how many sets have it and whether they agree.
   * Interacts with: the rows table.
   * Data: REGION in both sets with different values; OLD in one.
   */
  it('lists each entry name across the sets', async () => {
    await renderDialog();

    const region = screen.getByText('REGION').closest('tr') as HTMLElement;
    expect(region).toHaveTextContent('2 of 2');
    expect(region).toHaveTextContent('Mixed');
    expect(screen.getByText('OLD').closest('tr')).toHaveTextContent('1 of 2');
  });

  /**
   * Verifies: an edit and a removal are collected and saved in one request.
   * Interacts with: the entry dialog (stub returning fields); batchEditEnvironmentSets (stub).
   * Data: REGION set to "north"; OLD removed.
   */
  it('saves every change together', async () => {
    const { user, api, close } = await renderDialog({
      kind: 'EnvironmentVariable',
      targetName: 'REGION',
      valueSource: 'Plain',
      value: 'north',
      secretName: null,
      connectionName: null,
      connectionField: null,
    });

    await user.click(screen.getByRole('button', { name: 'Edit REGION' }));
    await user.click(screen.getByRole('button', { name: 'Remove OLD' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.batchEditEnvironmentSets).toHaveBeenCalledWith({
      environmentSetIds: ['a', 'b'],
      changes: [
        expect.objectContaining({
          operation: 'Upsert',
          targetName: 'REGION',
          value: 'north',
        }),
        expect.objectContaining({ operation: 'Delete', targetName: 'OLD' }),
      ],
    });
    expect(close).toHaveBeenCalledWith(sets);
  });

  /**
   * Verifies: an entry the sets that have it agree on is added where missing without editing it first.
   * Interacts with: the Add where missing checkbox; batchEditEnvironmentSets (stub).
   * Data: OLD = "x" in A only.
   */
  it('adds an entry where missing as the sets have it', async () => {
    const { user, api, open } = await renderDialog();

    await user.click(
      screen.getByRole('checkbox', { name: 'Add OLD where missing' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(open).not.toHaveBeenCalled();
    expect(api.batchEditEnvironmentSets).toHaveBeenCalledWith({
      environmentSetIds: ['a', 'b'],
      changes: [
        expect.objectContaining({
          operation: 'Upsert',
          targetName: 'OLD',
          valueSource: 'Plain',
          value: 'x',
        }),
      ],
    });
  });

  /**
   * Verifies: a mixed entry asks for its value before it is added where missing, and cancelling leaves it unchecked.
   * Interacts with: the entry dialog (stub answering nothing, as a cancel).
   * Data: REGION differs between A and B, and C lacks it.
   */
  it('asks for a value before adding a mixed entry where missing', async () => {
    const { user, open } = await renderDialog(undefined, threeSets);

    const checkbox = screen.getByRole('checkbox', {
      name: 'Add REGION where missing',
    });
    await user.click(checkbox);

    expect(open).toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  /**
   * Verifies: without ManageInfrastructure a connection entry can't be edited or added where missing, as the API would refuse the whole save, but can still be removed.
   * Interacts with: the row's controls.
   * Data: PROXMOX_VE_ENDPOINT read from a connection in A only.
   */
  it('locks a connection entry without permission to manage connections', async () => {
    const withConnection: EnvironmentSet[] = [
      {
        ...sets[0],
        entries: [
          {
            id: 'a3',
            kind: 'EnvironmentVariable',
            targetName: 'PROXMOX_VE_ENDPOINT',
            valueSource: 'Connection',
            connectionName: 'lab-pve',
            connectionField: 'ApiUrl',
          },
        ],
      },
      sets[1],
    ];
    await renderDialog(undefined, withConnection);

    expect(
      screen.getByRole('checkbox', {
        name: 'Add PROXMOX_VE_ENDPOINT where missing',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit PROXMOX_VE_ENDPOINT' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Remove PROXMOX_VE_ENDPOINT' }),
    ).toBeEnabled();
  });
});
