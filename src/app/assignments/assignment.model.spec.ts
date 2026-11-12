// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { assignmentDiff, saveLabel, sameName } from './assignment.model';

describe('assignment model', () => {
  /**
   * Verifies: the diff lists what the selection adds and removes, and nothing it keeps.
   * Data: a and b assigned; b and c selected.
   */
  it('diffs a selection against what was assigned', () => {
    expect(assignmentDiff(['a', 'b'], ['b', 'c'])).toEqual({
      add: ['c'],
      remove: ['a'],
    });
  });

  /**
   * Verifies: the save label counts the changes, singular and plural.
   */
  it('counts the changes in the save label', () => {
    expect(saveLabel(0)).toBe('Save');
    expect(saveLabel(1)).toBe('Save 1 change');
    expect(saveLabel(3)).toBe('Save 3 changes');
  });

  /**
   * Verifies: names compare without regard to case, as the API matches connections.
   */
  it('compares names without regard to case', () => {
    expect(sameName('LAB-pve', 'lab-PVE')).toBe(true);
    expect(sameName('lab-pve', 'lab-vcenter')).toBe(false);
    expect(sameName(null, '')).toBe(true);
  });
});
