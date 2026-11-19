// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ModelFile } from '../../generated/caster-api';
import { isFileContentChanged, normalizeLineEndings } from './file-content';

describe('file-content', () => {
  /**
   * Verifies: CRLF and bare CR both become LF; LF and null pass through.
   * Interacts with: normalizeLineEndings only.
   * Data: one row per ending style, plus null.
   */
  it.each([
    { value: 'a\r\nb', expected: 'a\nb' },
    { value: 'a\rb', expected: 'a\nb' },
    { value: 'a\nb\r\nc\rd', expected: 'a\nb\nc\nd' },
    { value: 'a\nb', expected: 'a\nb' },
    { value: null, expected: null },
  ])('normalizes $value to LF', ({ value, expected }) => {
    expect(normalizeLineEndings(value)).toBe(expected);
  });

  /**
   * Verifies: a file only counts as changed when its editor text differs by more than line endings.
   * Interacts with: isFileContentChanged, used by the tab-close and leave-page unsaved-changes guards.
   * Data: one row per case: what Monaco does to mixed, CRLF and bare-CR files; a real edit; a file with no editor buffer.
   */
  it.each([
    {
      name: 'mixed shown as CRLF',
      content: 'a\r\nb\nc',
      editorContent: 'a\r\nb\r\nc',
      changed: false,
    },
    {
      name: 'CRLF set to LF',
      content: 'a\r\nb',
      editorContent: 'a\nb',
      changed: false,
    },
    {
      name: 'bare CR shown as LF',
      content: 'a\rb',
      editorContent: 'a\nb',
      changed: false,
    },
    {
      name: 'a real edit',
      content: 'a\r\nb',
      editorContent: 'a\nb2',
      changed: true,
    },
    {
      name: 'no editorContent yet',
      content: 'a',
      editorContent: undefined,
      changed: false,
    },
  ])(
    'reports $name as changed: $changed',
    ({ content, editorContent, changed }) => {
      const file: ModelFile = { id: 'f1', content, editorContent };
      expect(isFileContentChanged(file)).toBe(changed);
    },
  );

  /**
   * Verifies: a file that is not in the store yet is never reported as unsaved.
   * Interacts with: isFileContentChanged with an undefined entity (FileQuery.getEntity miss).
   * Data: undefined.
   */
  it('reports a missing file as unchanged', () => {
    expect(isFileContentChanged(undefined)).toBe(false);
  });
});
