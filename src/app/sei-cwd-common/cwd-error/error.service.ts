// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, Injector, ErrorHandler } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SystemMessageService } from '../cwd-system-message/services/system-message.service';

@Injectable({
  providedIn: 'root',
})
export class ErrorService implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(err: any) {
    const messageService = this.injector.get(SystemMessageService);
    let title = '';
    let message = '';
    if (err instanceof HttpErrorResponse) {
      // Backend returns unsuccessful response codes such as 404, 500 etc.
      const apiError = err as HttpErrorResponse;
      title = apiError.error.title;
      message =
        'Code:  ' + apiError.status + '\nMessage: ' + apiError.message + '\n';
      message += apiError.error.detail;
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
}
