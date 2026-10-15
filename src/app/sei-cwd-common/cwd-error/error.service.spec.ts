// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  ProblemDetails,
  ValidationProblemDetails,
} from '../../generated/caster-api';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { SystemMessageService } from '../cwd-system-message/services/system-message.service';
import { ErrorService } from './error.service';

const API_URL = 'https://caster.test/api/projects/p1';

/**
 * The real ErrorService (the app's ErrorHandler, app.module.ts:107) with
 * SystemMessageService stubbed: the real one opens a MatBottomSheet after a
 * timeout, and what matters here is the title and message it is given.
 */
function setup() {
  const messages = {
    displayMessage: vi.fn(
      (_title: string, _message: string, _displayAfterMs?: number) => undefined,
    ),
  } satisfies Pick<SystemMessageService, 'displayMessage'>;
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      // The real service, replacing the default stub.
      ErrorService,
      { provide: SystemMessageService, useValue: messages },
    ]),
  });
  return { service: TestBed.inject(ErrorService), messages };
}

const codeAndMessage = (status: number, statusText: string) =>
  `<strong>Code:</strong> ${status} (${statusText})\n` +
  `<strong>Message:</strong> Http failure response for ${API_URL}: ${status} ${statusText}\n`;

describe('ErrorService.handleError', () => {
  beforeEach(() => {
    // handleError logs the title and the error; keep the output clean.
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  /**
   * Verifies: an API ProblemDetails error shows its title, the status line, the HTTP message and the detail, after a 1 s delay.
   * Interacts with: SystemMessageService.displayMessage (stub), console.log (spied).
   * Data: a 404 with ProblemDetails { title: 'Not Found', status: 404, detail: 'Project p1 not found' }.
   */
  it('shows the ProblemDetails title and detail', () => {
    const { service, messages } = setup();
    const problem: ProblemDetails = {
      title: 'Not Found',
      status: 404,
      detail: 'Project p1 not found',
    };
    const err = new HttpErrorResponse({
      error: problem,
      status: 404,
      statusText: 'Not Found',
      url: API_URL,
    });

    service.handleError(err);

    expect(messages.displayMessage).toHaveBeenCalledExactlyOnceWith(
      'Not Found',
      codeAndMessage(404, 'Not Found') + 'Project p1 not found\n',
      1000,
    );
    expect(vi.mocked(console.log).mock.calls).toEqual([['Not Found'], [err]]);
  });

  /**
   * Verifies: a ProblemDetails without detail shows only the status and HTTP message lines.
   * Interacts with: SystemMessageService.displayMessage (stub).
   * Data: a 500 with ProblemDetails { title: 'Server Error', status: 500 }.
   */
  it('omits the detail line when ProblemDetails has none', () => {
    const { service, messages } = setup();
    const err = new HttpErrorResponse({
      error: { title: 'Server Error', status: 500 } satisfies ProblemDetails,
      status: 500,
      statusText: 'Internal Server Error',
      url: API_URL,
    });

    service.handleError(err);

    expect(messages.displayMessage).toHaveBeenCalledExactlyOnceWith(
      'Server Error',
      codeAndMessage(500, 'Internal Server Error'),
      1000,
    );
  });

  /**
   * Verifies: a ValidationProblemDetails lists each invalid field in bold followed by its messages, instead of the status lines.
   * Interacts with: SystemMessageService.displayMessage (stub).
   * Data: a 400 with errors for Name (two messages) and DirectoryId (one).
   */
  it('lists validation errors per field', () => {
    const { service, messages } = setup();
    const validation: ValidationProblemDetails = {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: {
        Name: ['Name is required.', 'Name is too long.'],
        DirectoryId: ['Directory not found.'],
      },
    };
    const err = new HttpErrorResponse({
      error: validation,
      status: 400,
      statusText: 'Bad Request',
      url: API_URL,
    });

    service.handleError(err);

    expect(messages.displayMessage).toHaveBeenCalledExactlyOnceWith(
      'One or more validation errors occurred.',
      '<strong>Name</strong><br>Name is required.<br>Name is too long.<br><br>' +
        '<strong>DirectoryId</strong><br>Directory not found.<br><br>',
      1000,
    );
  });

  /**
   * Verifies: an HTTP error whose body isn't ProblemDetails (a proxy's HTML page, a network error's ProgressEvent) gets the generic title and the status lines.
   * Interacts with: SystemMessageService.displayMessage (stub).
   * Data: a 502 with an HTML string body; a status-0 error with a ProgressEvent body.
   */
  it('uses a generic title for non-ProblemDetails bodies', () => {
    const { service, messages } = setup();

    service.handleError(
      new HttpErrorResponse({
        error: '<html>Bad Gateway</html>',
        status: 502,
        statusText: 'Bad Gateway',
        url: API_URL,
      }),
    );
    service.handleError(
      new HttpErrorResponse({
        error: new ProgressEvent('error'),
        status: 0,
        statusText: 'Unknown Error',
        url: API_URL,
      }),
    );

    expect(messages.displayMessage.mock.calls).toEqual([
      ['An error has occurred', codeAndMessage(502, 'Bad Gateway'), 1000],
      [
        'An error has occurred',
        expect.stringContaining('<strong>Code:</strong> 0 (Unknown Error)'),
        1000,
      ],
    ]);
  });

  /**
   * Verifies: an HTTP error with an empty body makes handleError itself throw, so the user sees no message.
   * Interacts with: SystemMessageService.displayMessage (stub, asserted not called).
   * Data: a 401 with no body (HttpErrorResponse.error is null), as the JWT bearer challenge sends.
   */
  it('throws for an HTTP error with an empty body', () => {
    const { service, messages } = setup();
    const err = new HttpErrorResponse({
      status: 401,
      statusText: 'Unauthorized',
      url: API_URL,
    });
    expect(err.error).toBeNull();

    expect(() => service.handleError(err)).toThrow(TypeError);
    expect(messages.displayMessage).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a client-side Error shows "Client error occurred:" with its message and stack.
   * Interacts with: SystemMessageService.displayMessage (stub), console.log (spied).
   * Data: new TypeError('x is undefined').
   */
  it('shows client errors with their message and stack', () => {
    const { service, messages } = setup();
    const err = new TypeError('x is undefined');

    service.handleError(err);

    expect(messages.displayMessage).toHaveBeenCalledExactlyOnceWith(
      'Client error occurred:',
      `x is undefined \n${err.stack}`,
      1000,
    );
    expect(vi.mocked(console.log).mock.calls).toEqual([
      ['Client error occurred:'],
      [err],
    ]);
  });

  /**
   * Verifies: a thrown non-Error value produces the message "undefined \nundefined".
   * Interacts with: SystemMessageService.displayMessage (stub).
   * Data: a thrown string.
   */
  it('shows "undefined" for a thrown non-Error value', () => {
    const { service, messages } = setup();

    service.handleError('plain string');

    expect(messages.displayMessage).toHaveBeenCalledExactlyOnceWith(
      'Client error occurred:',
      'undefined \nundefined',
      1000,
    );
  });
});
