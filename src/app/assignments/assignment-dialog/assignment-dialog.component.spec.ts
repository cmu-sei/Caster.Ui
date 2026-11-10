// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AssignmentDiff } from '../assignment.model';
import {
  AssignmentDialogComponent,
  AssignmentDialogData,
} from './assignment-dialog.component';

async function renderDialog(
  save: (changes: AssignmentDiff[]) => Observable<unknown>,
  twoSections = false,
) {
  const { dialogRef, close } = dialogRefStub<AssignmentDialogComponent>();
  const data: AssignmentDialogData = {
    title: 'Assign vSphere',
    sections: [
      {
        label: 'Projects',
        items: [
          { id: 'p1', name: 'Range A' },
          { id: 'p2', name: 'Range B' },
        ],
        assigned: ['p1'],
      },
      ...(twoSections
        ? [
            {
              label: 'Project Groups',
              items: [{ id: 'g1', name: 'Lab' }],
              assigned: [],
            },
          ]
        : []),
    ],
    save: vi.fn(save),
  };

  const view = await renderComponent(AssignmentDialogComponent, {
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  return { ...view, data, close, user: userEvent.setup() };
}

describe('AssignmentDialogComponent', () => {
  /**
   * Verifies: Save counts the changes and hands them over per section, then closes the dialog with true.
   * Data: Range A assigned; add Range B, remove Range A.
   */
  it('saves what changed and closes', async () => {
    const { user, data, close } = await renderDialog(() => of(null));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(screen.getByRole('checkbox', { name: /Range A/ }));
    await user.click(screen.getByRole('button', { name: 'Save 2 changes' }));

    expect(data.save).toHaveBeenCalledWith([{ add: ['p2'], remove: ['p1'] }]);
    expect(close).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: with several sections each is a tab, and Save hands over every section's changes.
   * Data: Projects and Project Groups; add Lab.
   */
  it('shows each section as a tab', async () => {
    const { user, data } = await renderDialog(() => of(null), true);

    await user.click(screen.getByRole('tab', { name: 'Project Groups' }));
    await user.click(screen.getByRole('checkbox', { name: /Lab/ }));
    await user.click(screen.getByRole('button', { name: 'Save 1 change' }));

    expect(data.save).toHaveBeenCalledWith([
      { add: [], remove: [] },
      { add: ['g1'], remove: [] },
    ]);
  });

  /**
   * Verifies: a refused save shows why and leaves the dialog open.
   * Data: the save answers 409.
   */
  it('shows why a save was refused', async () => {
    const { user, close } = await renderDialog(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { title: 'REGION would be set by both' },
          }),
      ),
    );

    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(screen.getByRole('button', { name: 'Save 1 change' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'REGION would be set by both',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
