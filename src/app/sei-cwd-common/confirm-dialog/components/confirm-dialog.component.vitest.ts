// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SharedModule } from 'src/app/shared/shared.module';

function dialogProviders(
  data: any = {},
  closeFn: (...args: any[]) => void = () => {}
) {
  return [
    { provide: MAT_DIALOG_DATA, useValue: data },
    {
      provide: MatDialogRef,
      useValue: { close: closeFn, disableClose: false },
    },
  ];
}

async function renderDialog(
  overrides: {
    data?: any;
    closeFn?: (...args: any[]) => void;
    title?: string;
    message?: string;
  } = {}
) {
  const closeFn = overrides.closeFn ?? vi.fn();
  const result = await renderComponent(ConfirmDialogComponent, {
    declarations: [ConfirmDialogComponent],
    imports: [MatDialogModule, MatButtonModule, SharedModule],
    providers: dialogProviders(overrides.data ?? {}, closeFn),
    componentProperties: {
      ...(overrides.title != null ? { title: overrides.title } : {}),
      ...(overrides.message != null ? { message: overrides.message } : {}),
    } as any,
  });
  return { ...result, closeFn };
}

describe('ConfirmDialogComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
