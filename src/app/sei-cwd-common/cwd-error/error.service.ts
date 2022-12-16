// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, Injector, ErrorHandler } from '@angular/core';
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
  constructor(private injector: Injector) {}

  handleError(err: any) {
    const messageService = this.injector.get(SystemMessageService);
    let title = 'An error has occurred';
    let message = '';
    if (err instanceof HttpErrorResponse) {
      // Backend returns unsuccessful response codes such as 404, 500 etc.
      const apiError = err as HttpErrorResponse;
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

  private isProblemDetails(error: HttpErrorResponse): boolean {
    return error.error.title && error.error.status;
  }

  private isValidationProblemDetails(error: HttpErrorResponse): boolean {
    return this.isProblemDetails(error) && error.error.errors;
  }
}
