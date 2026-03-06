// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule } from '@angular/forms';
import { NameDialogComponent } from './name-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SharedModule } from 'src/app/shared/shared.module';

function dialogProviders(
  data: any = { nameValue: '' },
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
  } = {}
) {
  const closeFn = overrides.closeFn ?? vi.fn();
  const result = await renderComponent(NameDialogComponent, {
    declarations: [NameDialogComponent],
    imports: [
      MatDialogModule,
      MatButtonModule,
      MatFormFieldModule,
      MatInputModule,
      ReactiveFormsModule,
      SharedModule,
    ],
    providers: dialogProviders(overrides.data ?? { nameValue: '' }, closeFn),
  });
  return { ...result, closeFn };
}

describe('NameDialogComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
