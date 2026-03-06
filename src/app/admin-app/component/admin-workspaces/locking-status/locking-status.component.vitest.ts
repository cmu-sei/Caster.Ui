// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { LockingStatusComponent } from './locking-status.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('LockingStatusComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(LockingStatusComponent, {
      declarations: [LockingStatusComponent],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
