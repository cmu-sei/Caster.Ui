// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpHeaders, HttpResponse } from '@angular/common/http';

/**
 * The `observe: 'response'` payload of a generated export endpoint: a Blob
 * body plus the Content-Disposition header the state services read the
 * download's file name from.
 */
export function downloadResponse(
  filename: string,
  body: Blob = new Blob(['archive']),
): HttpResponse<Blob> {
  return new HttpResponse<Blob>({
    body,
    headers: new HttpHeaders({
      'content-disposition': `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
    }),
  });
}
