// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CwdToolbarActionItemComponent } from './cwd-toolbar-action-item.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('CwdToolbarActionItemComponent', () => {
  it('creates the component', async () => {
    // Add a target in the DOM for the DomPortalOutlet selector so
    // ngAfterViewInit can attach successfully.
    const target = document.createElement('div');
    target.id = 'toolbar-target-test';
    document.body.appendChild(target);
    try {
      const { fixture } = await renderComponent(CwdToolbarActionItemComponent, {
        declarations: [CwdToolbarActionItemComponent],
        schemas: [NO_ERRORS_SCHEMA],
        componentProperties: { selector: '#toolbar-target-test' },
      });
      expect(fixture.componentInstance).toBeTruthy();
    } finally {
      target.remove();
    }
  });
});
