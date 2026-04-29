// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TableItemActionDirective } from './table-item-action.directive';

describe('TableItemActionDirective', () => {
  it('creates an instance', () => {
    const directive = new TableItemActionDirective();
    expect(directive).toBeTruthy();
  });
});
