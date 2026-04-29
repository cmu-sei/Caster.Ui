// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { LockingStatusComponent } from './locking-status.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('LockingStatusComponent', () => {
  async function render(lockingEnabled: boolean) {
    return renderComponent(LockingStatusComponent, {
      declarations: [LockingStatusComponent],
      schemas: [NO_ERRORS_SCHEMA],
      componentProperties: { lockingEnabled },
    });
  }

  it('creates the component', async () => {
    const { fixture } = await render(false);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('toggleLocking emits the inverted flag', async () => {
    const { fixture } = await render(false);
    const spy = vi.fn();
    fixture.componentInstance.setLockingEnabled.subscribe(spy);
    const preventDefault = vi.fn();
    fixture.componentInstance.toggleLocking({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('toggleLocking emits false when currently enabled', async () => {
    const { fixture } = await render(true);
    const spy = vi.fn();
    fixture.componentInstance.setLockingEnabled.subscribe(spy);
    fixture.componentInstance.toggleLocking({ preventDefault: vi.fn() });
    expect(spy).toHaveBeenCalledWith(false);
  });
});
