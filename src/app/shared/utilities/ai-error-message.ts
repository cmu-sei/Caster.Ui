// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';

/** Why an AI request failed, for the Ask AI panel and the Terraform draft dialog. */
export function aiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse && err.status === 0) {
    return 'The API could not be reached.';
  }
  return err ? apiErrorMessage(err) : fallback;
}
