// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ModelFile } from '../../generated/caster-api';

// Monaco normalizes line endings when it loads a file (mixed endings become
// all CRLF, bare CR becomes LF), so comparisons ignore line-ending-only
// differences to avoid reporting unedited files as unsaved.
export function normalizeLineEndings(value: string): string {
  return value == null ? value : value.replace(/\r\n?/g, '\n');
}

export function isSameContent(a: string, b: string): boolean {
  return normalizeLineEndings(a ?? '') === normalizeLineEndings(b ?? '');
}

// A file without an editor buffer has no edits.
export function isFileContentChanged(file: ModelFile): boolean {
  return (
    !!file &&
    file.editorContent != null &&
    !isSameContent(file.editorContent, file.content)
  );
}
