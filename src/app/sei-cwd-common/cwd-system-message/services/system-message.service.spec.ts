// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApplicationRef, NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { screen, within } from '@testing-library/angular';
import { SystemMessageComponent } from '../components/system-message.component';
import { SystemMessageService } from './system-message.service';

/**
 * Configures the real SystemMessageService over the real root MatBottomSheet,
 * with SystemMessageComponent declared as in AppModule, and returns the service.
 */
function setup(): SystemMessageService {
  TestBed.configureTestingModule({
    imports: [
      NoopAnimationsModule,
      MatBottomSheetModule,
      MatButtonModule,
      MatExpansionModule,
      MatIconModule,
      MatIconTestingModule,
    ],
    declarations: [SystemMessageComponent],
    providers: [SystemMessageService],
  });
  return TestBed.inject(SystemMessageService);
}

/** Returns the open bottom sheet container, or null when none is open. */
function sheetContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>('mat-bottom-sheet-container');
}

describe('SystemMessageService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Verifies: displayMessage opens one bottom sheet that renders SystemMessageComponent with the title as its heading and the message as its details.
   * Interacts with: the real root MatBottomSheet and its overlay container, NgZone (the 0 ms timeout); SystemMessageComponent template (declared as in AppModule).
   * Data: title 'Save failed', message 'The workspace could not be applied.'; default delay of 0 ms.
   */
  it('opens the system message bottom sheet with the title and message', async () => {
    const service = setup();

    // Called inside Angular's zone so whenStable tracks the setTimeout.
    TestBed.inject(NgZone).run(() =>
      service.displayMessage(
        'Save failed',
        'The workspace could not be applied.',
      ),
    );
    await TestBed.inject(ApplicationRef).whenStable();

    const sheet = sheetContainer();
    expect(sheet).not.toBeNull();
    const content = within(sheet as HTMLElement);
    expect(
      content.getByRole('heading', { level: 2, name: 'Save failed' }),
    ).toBeInTheDocument();
    expect(
      content.getByText('The workspace could not be applied.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: 'Save failed' }),
    ).toHaveLength(1);
  });

  /**
   * Verifies: with a delay, displayMessage opens the sheet only once the delay has passed (ErrorService passes 1000 ms).
   * Interacts with: the real root MatBottomSheet, NgZone, ApplicationRef.tick; Vitest fake timers for the delay.
   * Data: title 'An error has occurred', message 'Gateway timeout'; displayAfterMs 1000.
   */
  it('opens the sheet only after displayAfterMs has passed', () => {
    vi.useFakeTimers();
    const service = setup();
    const appRef = TestBed.inject(ApplicationRef);

    TestBed.inject(NgZone).run(() =>
      service.displayMessage('An error has occurred', 'Gateway timeout', 1000),
    );
    vi.advanceTimersByTime(999);
    appRef.tick();

    expect(sheetContainer()).toBeNull();

    vi.advanceTimersByTime(1);
    appRef.tick();

    const sheet = sheetContainer();
    expect(sheet).not.toBeNull();
    const content = within(sheet as HTMLElement);
    expect(
      content.getByRole('heading', { level: 2, name: 'An error has occurred' }),
    ).toBeInTheDocument();
    expect(content.getByText('Gateway timeout')).toBeInTheDocument();
  });
});
