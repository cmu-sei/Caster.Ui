// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { SystemMessageComponent } from './system-message.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderMsg(
  overrides: { title?: string; message?: string } = {},
) {
  const { title = 'Hi', message = 'hello world' } = overrides;
  const dismiss = vi.fn();
  const rendered = await renderComponent(SystemMessageComponent, {
    declarations: [SystemMessageComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: MatBottomSheetRef, useValue: { dismiss } },
      { provide: MAT_BOTTOM_SHEET_DATA, useValue: { title, message } },
    ],
  });
  return { ...rendered, dismiss };
}

describe('SystemMessageComponent (cwd)', () => {
  it('creates and captures the title/message', async () => {
    const { fixture } = await renderMsg({ title: 'Warning', message: 'Be careful' });
    expect(fixture.componentInstance.displayTitle).toBe('Warning');
    expect(fixture.componentInstance.displayMessage).toBe('Be careful');
  });

  it('close() dismisses the bottom sheet', async () => {
    const { fixture, dismiss } = await renderMsg();
    fixture.componentInstance.close();
    expect(dismiss).toHaveBeenCalled();
  });
});
