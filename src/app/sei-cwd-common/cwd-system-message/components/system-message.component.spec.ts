// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { bottomSheetRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SystemMessageComponent } from './system-message.component';

describe('SystemMessageComponent', () => {
  /**
   * Verifies: the sheet shows the message title and details, and Close dismisses it.
   * Interacts with: MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef.dismiss (bottomSheetRefStub).
   * Data: title "Save failed", message "Conflict".
   */
  it('shows the message and closes the sheet', async () => {
    const { sheetRef, dismiss } = bottomSheetRefStub<SystemMessageComponent>();
    await renderComponent(SystemMessageComponent, {
      imports: [MatButtonModule, MatIconModule, MatExpansionModule],
      providers: [
        { provide: MatBottomSheetRef, useValue: sheetRef },
        {
          provide: MAT_BOTTOM_SHEET_DATA,
          useValue: { title: 'Save failed', message: 'Conflict' },
        },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Save failed' })).toBeVisible();
    expect(screen.getByText('Conflict')).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Close' }));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
