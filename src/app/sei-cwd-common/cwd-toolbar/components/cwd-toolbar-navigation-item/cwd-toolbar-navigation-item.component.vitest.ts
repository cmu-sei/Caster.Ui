// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CwdToolbarNavigationItemComponent } from './cwd-toolbar-navigation-item.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('CwdToolbarNavigationItemComponent', () => {
  it('creates the component', async () => {
    const target = document.createElement('div');
    target.id = 'toolbar-navigation';
    document.body.appendChild(target);
    try {
      const { fixture } = await renderComponent(
        CwdToolbarNavigationItemComponent,
        {
          declarations: [CwdToolbarNavigationItemComponent],
          schemas: [NO_ERRORS_SCHEMA],
        },
      );
      expect(fixture.componentInstance).toBeTruthy();
    } finally {
      target.remove();
    }
  });
});
