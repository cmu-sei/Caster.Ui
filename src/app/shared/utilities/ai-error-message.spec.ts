// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { describe, it, expect } from 'vitest';
import { aiErrorMessage } from './ai-error-message';

describe('aiErrorMessage', () => {
  it('says the API could not be reached when there is no response', () => {
    const err = new HttpErrorResponse({ status: 0 });

    expect(aiErrorMessage(err, 'fallback')).toBe(
      'The API could not be reached.',
    );
  });

  it("gives the API's title and detail", () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: {
        title: 'Conflict',
        detail: 'AI drafting is not enabled on this server',
      },
    });

    expect(aiErrorMessage(err, 'fallback')).toBe(
      'Conflict AI drafting is not enabled on this server',
    );
  });

  it('uses the fallback when there is no error', () => {
    expect(aiErrorMessage(null, 'The request failed.')).toBe(
      'The request failed.',
    );
  });
});
