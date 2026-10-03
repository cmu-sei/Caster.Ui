// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import HttpHeaderUtils from './http-header-utils';

const filenameFrom = (contentDisposition: string) =>
  HttpHeaderUtils.getFilename(
    new HttpHeaders({ 'Content-Disposition': contentDisposition }),
  );

describe('HttpHeaderUtils.getFilename', () => {
  /**
   * Verifies: the file name is read from a plain or quoted `filename=` parameter, whatever the header name's case.
   * Interacts with: HttpHeaders.get (case-insensitive).
   * Data: unquoted, double-quoted (with a space) and single-quoted names.
   */
  it.each([
    ['attachment; filename=project.zip', 'project.zip'],
    ['attachment; filename="my project.zip"', 'my project.zip'],
    ["attachment; filename='main.tf'", 'main.tf'],
    ['attachment; filename=export.zip; size=42', 'export.zip'],
  ])('reads %s', (header, expected) => {
    expect(filenameFrom(header)).toBe(expected);
  });

  /**
   * Verifies: for ASP.NET Core's two-parameter header, the ASCII `filename=` value is used.
   * Interacts with: HttpHeaders.get.
   * Data: `filename=project.zip; filename*=UTF-8''project.zip`, as File(..., fileDownloadName) sends it.
   */
  it('uses filename= when ASP.NET also sends filename*', () => {
    expect(
      filenameFrom(
        "attachment; filename=project.zip; filename*=UTF-8''project.zip",
      ),
    ).toBe('project.zip');
  });

  /**
   * Verifies: a non-ASCII name comes back as ASP.NET's ASCII fallback, because `filename=` comes first in the header and wins.
   * Interacts with: HttpHeaders.get.
   * Data: a file named naïve.tf, sent as `filename=na_ve.tf; filename*=UTF-8''na%C3%AFve.tf`.
   */
  it('returns the ASCII fallback instead of the UTF-8 filename*', () => {
    // NOTE: this holds with the escaped regex too: match() finds the first
    // `filename=` and nothing decodes an RFC 5987 value. Returning 'naïve.tf'
    // would mean preferring `filename*` and decoding it, a product choice
    // rather than a defect.
    expect(
      filenameFrom(
        "attachment; filename=na_ve.tf; filename*=UTF-8''na%C3%AFve.tf",
      ),
    ).toBe('na_ve.tf');
  });

  /**
   * Verifies: a header carrying only the RFC 5987 `filename*=` form throws a TypeError instead of returning a name.
   * Interacts with: HttpHeaders.get.
   * Data: `attachment; filename*=UTF-8''main.tf`.
   */
  it('throws when only filename* is present', () => {
    expect(() => filenameFrom("attachment; filename*=UTF-8''main.tf")).toThrow(
      TypeError,
    );
  });

  /**
   * Verifies: a response without Content-Disposition throws a TypeError.
   * Interacts with: HttpHeaders.get (returns null).
   * Data: empty HttpHeaders.
   */
  it('throws when the header is missing', () => {
    // NOTE: caster.api exposes the header to CORS
    // (Infrastructure/Extensions/CorsExtensions.cs:55); without that the
    // browser would hide it and every download would fail here.
    expect(() => HttpHeaderUtils.getFilename(new HttpHeaders())).toThrow(
      TypeError,
    );
  });
});
