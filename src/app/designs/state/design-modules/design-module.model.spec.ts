// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { createDesignModule } from './design-module.model';

describe('createDesignModule', () => {
  /**
   * Verifies: the factory ignores its argument and returns an empty object.
   * Interacts with: createDesignModule (pure).
   * Data: a partial DesignModule with an id and a name.
   */
  it('returns an empty DesignModule whatever it is given', () => {
    // NOTE: this is the unused Akita schematic stub; nothing in the app calls
    // it, and it does not copy any of the given fields.
    expect(createDesignModule({ id: 'x1', name: 'given' })).toEqual({});
  });
});
