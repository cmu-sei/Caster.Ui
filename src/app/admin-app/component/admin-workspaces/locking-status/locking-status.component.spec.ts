// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { renderComponent } from '../../../../test-utils/render-component';
import { LockingStatusComponent } from './locking-status.component';

describe('LockingStatusComponent', () => {
  /**
   * Verifies: the toggle reads "on" when locking is disabled, and clicking it asks for the opposite locking state.
   * Interacts with: the setLockingEnabled output.
   * Data: lockingEnabled true, then the toggle clicked.
   */
  it('requests disabling locking when the toggle is clicked', async () => {
    const setLockingEnabled = vi.fn<(enabled: boolean) => void>();
    await renderComponent(LockingStatusComponent, {
      imports: [MatSlideToggleModule, MatTooltipModule],
      inputs: { lockingEnabled: true },
      on: { setLockingEnabled },
    });

    const toggle = screen.getByRole('switch', {
      name: 'Disable Workspace Operations',
    });
    expect(toggle).not.toBeChecked();
    await userEvent.setup().click(toggle);

    expect(setLockingEnabled).toHaveBeenCalledWith(false);
  });
});
