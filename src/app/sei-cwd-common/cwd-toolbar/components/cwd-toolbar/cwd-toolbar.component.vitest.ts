// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CwdToolbarComponent } from './cwd-toolbar.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('CwdToolbarComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(CwdToolbarComponent, {
      declarations: [CwdToolbarComponent],
      imports: [MatToolbarModule],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });
});
