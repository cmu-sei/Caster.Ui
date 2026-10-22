// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { createVariable } from './variable.model';

describe('createVariable', () => {
  /**
   * Verifies: the factory ignores its argument and returns an empty object.
   * Interacts with: createVariable (pure).
   * Data: a partial Variable with an id and a name.
   */
  it('returns an empty Variable whatever it is given', () => {
    // NOTE: this is the unused Akita schematic stub; nothing in the app calls
    // it, and it does not copy any of the given fields.
    expect(createVariable({ id: 'x1', name: 'given' })).toEqual({});
  });
});
