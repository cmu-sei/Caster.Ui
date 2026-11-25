// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, Injector, ErrorHandler, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SystemMessageService } from '../cwd-system-message/services/system-message.service';
import {
  ProblemDetails,
  ValidationProblemDetails,
} from 'src/app/generated/caster-api';

@Injectable({
  providedIn: 'root',
})
export class ErrorService implements ErrorHandler {
  private injector = inject(Injector);

  handleError(err: any) {
    const messageService = this.injector.get(SystemMessageService);
    let title = 'An error has occurred';
    let message = '';
    if (err instanceof HttpErrorResponse) {
      // Backend returns unsuccessful response codes such as 404, 500 etc.
      const apiError = err as HttpErrorResponse;
      if (apiError.status === 0) {
        // The browser could not reach the API at all (it is down, or the network is).
        this.showApiUnreachable(messageService, apiError);
        return;
      }
      let problemDetails: ProblemDetails = null;

      if (this.isProblemDetails(err)) {
        problemDetails = err.error as ProblemDetails;
        title = problemDetails.title;
      }

      if (this.isValidationProblemDetails(err)) {
        const validationError = err.error as ValidationProblemDetails;
        Object.keys(validationError.errors).forEach((key) => {
          message += `<strong>${key}</strong><br>`;
          Object.keys(validationError.errors[key]).forEach((innerKey) => {
            message += `${validationError.errors[key][innerKey]}<br>`;
          });
          message += '<br>';
        });
      } else {
        message = `<strong>Code:</strong> ${apiError.status} (${apiError.statusText})\n<strong>Message:</strong> ${apiError.message}\n`;

        if (problemDetails?.detail) {
          message += `${problemDetails.detail}\n`;
        }
      }

      console.log(title);
      console.log(apiError);
    } else if (this.isApiUnreachable(err)) {
      // SignalR or another request failed because the API is down.
      this.showApiUnreachable(messageService, err);
      return;
    } else {
      // A client-side or network error occurred.
      const error = err as Error;
      title = 'Client error occurred:';
      message = error.message + ' \n' + error.stack;
      console.log(title);
      console.log(err);
    }
    // Delay 1 second to allow page to load.  This prevents error message from popping up irregularly
    messageService.displayMessage(title, message, 1000);
  }

  private showApiUnreachable(
    messageService: SystemMessageService,
    cause: unknown,
  ) {
    // SystemMessageService drops a repeat of a message that is already open.
    console.log('API unreachable:', cause);
    messageService.displayMessage(
      'API Error',
      'The API could not be reached.',
      1000,
    );
  }

  private isApiUnreachable(err: unknown): boolean {
    // A SignalR or promise failure carries the cause in `rejection`.
    const failure = err as {
      message?: string;
      rejection?: { message?: string };
    } | null;

    const text = `${failure?.message ?? ''} ${failure?.rejection?.message ?? ''}`;
    return [
      'Failed to fetch',
      'Failed to start the connection',
      'Failed to complete negotiation',
      'Network Error',
    ].some((fragment) => text.includes(fragment));
  }

  private isProblemDetails(error: HttpErrorResponse): boolean {
    return error.error.title && error.error.status;
  }

  private isValidationProblemDetails(error: HttpErrorResponse): boolean {
    return this.isProblemDetails(error) && error.error.errors;
  }
}
