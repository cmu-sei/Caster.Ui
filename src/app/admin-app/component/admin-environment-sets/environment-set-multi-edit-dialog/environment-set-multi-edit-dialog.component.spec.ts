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

async function renderDialog(entryDialogResult: unknown = undefined) {
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
          sets,
          secrets: null,
          connections: [],
          canUseConnections: false,
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
});
