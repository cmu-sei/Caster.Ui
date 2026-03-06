// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
  MatBottomSheetModule,
} from '@angular/material/bottom-sheet';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SystemMessageComponent } from './system-message.component';
import { renderComponent } from 'src/app/test-utils/render-component';

function sheetProviders(
  data: any = { title: '', message: '' },
  dismissFn: () => void = () => {}
) {
  return [
    { provide: MAT_BOTTOM_SHEET_DATA, useValue: data },
    { provide: MatBottomSheetRef, useValue: { dismiss: dismissFn } },
  ];
}

async function renderSheet(data?: { title: string; message: string }) {
  return renderComponent(SystemMessageComponent, {
    declarations: [SystemMessageComponent],
    imports: [
      MatBottomSheetModule,
      MatExpansionModule,
      MatIconModule,
      MatButtonModule,
    ],
    providers: sheetProviders(data ?? { title: 'Test Title', message: 'Test Message' }),
  });
}

describe('SystemMessageComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderSheet();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
