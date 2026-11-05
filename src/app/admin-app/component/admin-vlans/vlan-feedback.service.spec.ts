// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { VlanFeedbackService } from './vlan-feedback.service';

const snackConfig = {
  duration: 5000,
  verticalPosition: 'top',
  horizontalPosition: 'center',
};

function setup() {
  const open = vi.fn();
  TestBed.configureTestingModule({
    providers: [{ provide: MatSnackBar, useValue: { open } }],
  });
  return { service: TestBed.inject(VlanFeedbackService), open };
}

describe('VlanFeedbackService', () => {
  /**
   * Verifies: a successful call shows its message (fixed or built from the result) with Dismiss, as on the Modules page, and passes the result on.
   * Interacts with: MatSnackBar.open (stub).
   * Data: results 'a' and [1, 2].
   */
  it('reports a success', () => {
    const { service, open } = setup();
    const next = vi.fn();

    service.report(of('a'), 'Done', 'Failed').subscribe(next);
    service.report(of([1, 2]), (r) => `Got ${r.length}`, 'Failed').subscribe();

    expect(next).toHaveBeenCalledWith('a');
    expect(open).toHaveBeenNthCalledWith(1, 'Done', 'Dismiss', snackConfig);
    expect(open).toHaveBeenNthCalledWith(2, 'Got 2', 'Dismiss', snackConfig);
  });

  /**
   * Verifies: a failed call shows the failure with the API problem title, detail and validation messages, calls onError, and completes without erroring (so the global error dialog never sees it).
   * Interacts with: MatSnackBar.open (stub).
   * Data: a 400 ProblemDetails with title, detail and a Vlans validation error.
   */
  it('reports an API failure and swallows it', () => {
    const { service, open } = setup();
    const onError = vi.fn();
    const error = vi.fn();
    const complete = vi.fn();
    const response = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'Bad Request',
        detail: 'Not enough VLANs.',
        errors: { Vlans: ['Vlans must be at least 1.'] },
      },
    });

    service
      .report(
        throwError(() => response),
        'Done',
        'Could not add',
        onError,
      )
      .subscribe({ error, complete });

    expect(open).toHaveBeenCalledWith(
      'Could not add: Bad Request Not enough VLANs. Vlans must be at least 1.',
      'Dismiss',
      snackConfig,
    );
    expect(onError).toHaveBeenCalledWith(response);
    expect(error).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalled();
  });

  /**
   * Verifies: an error without a problem body falls back to its message, and VLAN counts read "1 VLAN" / "5 VLANs".
   * Interacts with: the static describe() and vlans() helpers.
   * Data: Error('offline'); counts 1 and 5.
   */
  it('describes plain errors and counts VLANs', () => {
    expect(VlanFeedbackService.describe(new Error('offline'))).toBe('offline');
    expect(VlanFeedbackService.vlans(1)).toBe('1 VLAN');
    expect(VlanFeedbackService.vlans(5)).toBe('5 VLANs');
  });
});
