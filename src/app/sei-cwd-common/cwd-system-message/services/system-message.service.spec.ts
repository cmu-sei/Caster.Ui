// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApplicationRef, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import {
  MatBottomSheet,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
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
 * with the standalone SystemMessageComponent, and returns the service.
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
      SystemMessageComponent,
    ],
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
   * Interacts with: the real root MatBottomSheet and its overlay container, NgZone (the 0 ms timeout); SystemMessageComponent template (standalone).
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

  /**
   * Verifies: the same title and message is not opened again while its sheet is showing, but is opened again after the sheet is dismissed.
   * Interacts with: the real root MatBottomSheet (open spied, dismiss), NgZone, ApplicationRef.
   * Data: three displayMessage calls with title 'API Error', message 'The API could not be reached.'.
   */
  it('does not open a repeat of the message that is showing', async () => {
    const service = setup();
    const zone = TestBed.inject(NgZone);
    const appRef = TestBed.inject(ApplicationRef);
    const open = vi.spyOn(TestBed.inject(MatBottomSheet), 'open');
    const show = () =>
      zone.run(() =>
        service.displayMessage('API Error', 'The API could not be reached.'),
      );

    show();
    show();
    await appRef.whenStable();

    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('heading', { name: 'API Error' })).toHaveLength(
      1,
    );

    TestBed.inject(MatBottomSheet).dismiss();
    await appRef.whenStable();
    expect(sheetContainer()).toBeNull();

    show();
    await appRef.whenStable();

    expect(open).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('heading', { name: 'API Error' })).toHaveLength(
      1,
    );
  });

  /**
   * Verifies: a replaced sheet finishing its exit does not clear the duplicate mark of a newer sheet with the same message.
   * Interacts with: a fake MatBottomSheet whose sheets are dismissed by the test.
   * Data: message A opened, replaced by B, A opened again, then the first A reports dismissed, then A is requested again.
   */
  it('keeps the duplicate mark of the newest sheet when an older one is dismissed', () => {
    vi.useFakeTimers();
    const dismissed: Subject<void>[] = [];
    const open = vi.fn(() => {
      const done = new Subject<void>();
      dismissed.push(done);
      return { afterDismissed: () => done.asObservable() };
    });
    TestBed.configureTestingModule({
      providers: [
        SystemMessageService,
        { provide: MatBottomSheet, useValue: { open } },
      ],
    });
    const service = TestBed.inject(SystemMessageService);
    const show = (title: string) => {
      service.displayMessage(title, 'details');
      vi.runAllTimers();
    };

    show('A');
    show('B');
    show('A');
    expect(open).toHaveBeenCalledTimes(3);

    dismissed[0].next();
    show('A');

    expect(open).toHaveBeenCalledTimes(3);
  });
});
