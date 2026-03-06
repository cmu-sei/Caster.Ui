// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { PartitionComponent } from './partition.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('PartitionComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(PartitionComponent, {
      declarations: [PartitionComponent],
      imports: [MatSnackBarModule],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
