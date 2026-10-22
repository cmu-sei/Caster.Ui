// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { toTerraformName, ValidatorPatterns } from './validator-patterns';

describe('toTerraformName', () => {
  /**
   * Verifies: a display name becomes a Terraform block label: runs of other characters become one underscore, surrounding spaces are dropped, and a name that does not start with a letter or underscore gets a leading underscore; the result matches ValidatorPatterns.TerraformName.
   * Interacts with: nothing (pure function).
   * Data: one display name per row, including null.
   */
  it.each([
    { name: 'Blank Machine', expected: 'Blank_Machine' },
    { name: 'Router / Gateway', expected: 'Router_Gateway' },
    { name: '  web  ', expected: 'web' },
    { name: 'web-server_1', expected: 'web-server_1' },
    { name: '2nd box', expected: '_2nd_box' },
    { name: '-edge', expected: '_-edge' },
    { name: null, expected: '_' },
  ])('turns $name into $expected', ({ name, expected }) => {
    const result = toTerraformName(name);

    expect(result).toBe(expected);
    expect(result).toMatch(new RegExp(ValidatorPatterns.TerraformName));
  });
});

describe('ValidatorPatterns.TerraformName', () => {
  /**
   * Verifies: the pattern accepts names that start with a letter or underscore followed by letters, digits, - and _, and rejects anything else.
   * Interacts with: nothing (a regular expression).
   * Data: one candidate name per row.
   */
  it.each([
    { name: 'web', valid: true },
    { name: '_web-1', valid: true },
    { name: 'web server', valid: false },
    { name: '1web', valid: false },
    { name: '-web', valid: false },
    { name: 'web.1', valid: false },
    { name: '', valid: false },
  ])('treats "$name" as valid: $valid', ({ name, valid }) => {
    expect(new RegExp(ValidatorPatterns.TerraformName).test(name)).toBe(valid);
  });
});
