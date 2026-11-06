// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/**
 * Snack bar feedback for the VLAN admin actions, in the same style as the
 * Modules admin page. Failures are shown here and swallowed, so they do not
 * also reach the global error dialog.
 */
@Injectable({ providedIn: 'root' })
export class VlanFeedbackService {
  private snackBar = inject(MatSnackBar);

  /**
   * Show `success` when the call succeeds; on failure show `failure` with the
   * API's problem title and detail, and complete without erroring.
   */
  report<T>(
    call: Observable<T>,
    success: string | ((result: T) => string),
    failure: string,
    onError?: (error: unknown) => void,
  ): Observable<T> {
    return call.pipe(
      tap((result) =>
        this.show(typeof success === 'function' ? success(result) : success),
      ),
      catchError((error) => {
        this.show(`${failure}: ${VlanFeedbackService.describe(error)}`);
        onError?.(error);
        return EMPTY;
      }),
    );
  }

  show(message: string) {
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      verticalPosition: 'top',
      horizontalPosition: 'center',
    });
  }

  /** The problem title and detail (or validation messages) of an API error. */
  static describe(error: any): string {
    const problem = error?.error;
    const parts: string[] = [];
    if (problem?.title) {
      parts.push(problem.title);
    }
    if (problem?.detail) {
      parts.push(problem.detail);
    }
    if (problem?.errors && typeof problem.errors === 'object') {
      for (const messages of Object.values(problem.errors)) {
        parts.push(...[].concat(messages));
      }
    }
    if (parts.length === 0) {
      parts.push(error?.message || 'Unknown error');
    }
    return parts.join(' ');
  }

  /** "1 VLAN" / "5 VLANs". */
  static vlans(count: number): string {
    return `${count} VLAN${count === 1 ? '' : 's'}`;
  }
}
