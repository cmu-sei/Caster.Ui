// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { HotkeysService } from '@ngneat/hotkeys';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { HotkeysHelpDialogComponent } from './hotkeys-help-dialog.component';

describe('HotkeysHelpDialogComponent', () => {
  /**
   * Verifies: the dialog lists the registered shortcuts by group with their keys, and Close closes it.
   * Interacts with: HotkeysService.getShortcuts (stub), MatDialogRef.close (dialogRefStub).
   * Data: group Files with "Save file" on control.s.
   */
  it('lists the shortcuts and closes', async () => {
    const hotkeys = {
      getShortcuts: vi.fn(() => [
        {
          group: 'Files',
          hotkeys: [{ keys: 'control.s', description: 'Save file' }],
        },
      ]),
    } satisfies Pick<HotkeysService, 'getShortcuts'>;
    const { dialogRef, close } = dialogRefStub<HotkeysHelpDialogComponent>();
    await renderComponent(HotkeysHelpDialogComponent, {
      imports: [...CRUCIBLE_DIALOG_IMPORTS, A11yModule, MatButtonModule],
      providers: [
        { provide: HotkeysService, useValue: hotkeys },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument();
    const row = screen.getByText('Save file').closest('tr') as HTMLElement;
    expect(within(row).getByText('Control')).toBeInTheDocument();
    expect(within(row).getByText('S')).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Close' }));

    expect(close).toHaveBeenCalled();
  });
});
