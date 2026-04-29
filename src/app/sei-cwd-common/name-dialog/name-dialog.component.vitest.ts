// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from './name-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderDialog(
  overrides: { data?: Record<string, unknown> } = {},
) {
  const { data = { nameValue: 'Alpha' } } = overrides;
  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    NameDialogComponent
  >;
  const rendered = await renderComponent(NameDialogComponent, {
    declarations: [NameDialogComponent],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  return { ...rendered, close, dialogRef, data };
}

describe('NameDialogComponent (cwd)', () => {
  it('creates, sets disableClose, seeds form from data', async () => {
    const { fixture, dialogRef } = await renderDialog({ data: { nameValue: 'Hi' } });
    expect(fixture.componentInstance).toBeTruthy();
    expect(dialogRef.disableClose).toBe(true);
    expect(fixture.componentInstance.form.value.name).toBe('Hi');
  });

  it('applies extra validators from data.validators', async () => {
    const { fixture } = await renderDialog({
      data: {
        nameValue: 'x',
        validators: [{ name: 'minLength', validator: Validators.minLength(5) }],
      },
    });
    expect(fixture.componentInstance.form.controls['name'].valid).toBe(false);
  });

  it('onClick() closes with wasCancelled=false + the edited name', async () => {
    const { fixture, close, data } = await renderDialog({ data: { nameValue: 'A' } });
    fixture.componentInstance.form.get('name').setValue('B');
    fixture.componentInstance.onClick();
    expect(close).toHaveBeenCalledWith(data);
    expect(data.nameValue).toBe('B');
    expect(data.wasCancelled).toBe(false);
  });

  it('onCancel() closes with wasCancelled=true', async () => {
    const { fixture, close, data } = await renderDialog();
    fixture.componentInstance.onCancel();
    expect(close).toHaveBeenCalledWith(data);
    expect(data.wasCancelled).toBe(true);
  });
});
