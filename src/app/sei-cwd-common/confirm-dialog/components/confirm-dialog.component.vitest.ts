// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderDialog(
  overrides: { data?: Record<string, unknown> } = {},
) {
  const { data = {} } = overrides;
  const close = vi.fn();
  const dialogRef = { close, disableClose: false } as unknown as MatDialogRef<
    ConfirmDialogComponent
  >;
  const rendered = await renderComponent(ConfirmDialogComponent, {
    declarations: [ConfirmDialogComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  });
  return { ...rendered, close, dialogRef, data };
}

describe('ConfirmDialogComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets disableClose on the dialog ref', async () => {
    const { dialogRef } = await renderDialog();
    expect(dialogRef.disableClose).toBe(true);
  });

  it('defaults button labels to Yes/No', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance.buttonTrueText).toBe('Yes');
    expect(fixture.componentInstance.buttonFalseText).toBe('No');
  });

  it('uses custom button labels from data when provided', async () => {
    const { fixture } = await renderDialog({
      data: { buttonTrueText: 'Delete', buttonFalseText: 'Keep' },
    });
    expect(fixture.componentInstance.buttonTrueText).toBe('Delete');
    expect(fixture.componentInstance.buttonFalseText).toBe('Keep');
  });

  it('onClick(true) closes with confirm=true and wasCancelled=false', async () => {
    const { fixture, close, data } = await renderDialog();
    fixture.componentInstance.onClick(true);
    expect(close).toHaveBeenCalledWith(data);
    expect(data.confirm).toBe(true);
    expect(data.wasCancelled).toBe(false);
  });

  it('onClick(false) closes with confirm=false', async () => {
    const { fixture, data } = await renderDialog();
    fixture.componentInstance.onClick(false);
    expect(data.confirm).toBe(false);
  });

  it('onCancel() closes with wasCancelled=true', async () => {
    const { fixture, data } = await renderDialog();
    fixture.componentInstance.onCancel();
    expect(data.wasCancelled).toBe(true);
  });

  it('preserves removeArtifacts user choice when artifacts exist', async () => {
    const { fixture, data } = await renderDialog({
      data: { artifacts: ['a1'] },
    });
    fixture.componentInstance.removeArtifacts = true;
    fixture.componentInstance.onClick(true);
    expect(data.removeArtifacts).toBe(true);
  });
});
