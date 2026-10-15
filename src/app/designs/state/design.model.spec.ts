// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { createDesign } from './design.model';

describe('createDesign', () => {
  /**
   * Verifies: the factory ignores its argument and returns an empty object.
   * Interacts with: createDesign (pure).
   * Data: a partial Design with an id and a name.
   */
  it('returns an empty Design whatever it is given', () => {
    // NOTE: this is the unused Akita schematic stub; nothing in the app calls
    // it, and it does not copy any of the given fields.
    expect(createDesign({ id: 'x1', name: 'given' })).toEqual({});
  });
});
