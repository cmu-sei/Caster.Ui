// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TableActionDirective } from './table-action.directive';

describe('TableActionDirective', () => {
  it('creates an instance', () => {
    const directive = new TableActionDirective();
    expect(directive).toBeTruthy();
  });
});
