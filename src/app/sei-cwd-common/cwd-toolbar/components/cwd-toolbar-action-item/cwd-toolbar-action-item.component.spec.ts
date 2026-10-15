// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import { PortalModule } from '@angular/cdk/portal';
import { MatToolbarModule } from '@angular/material/toolbar';
import { renderComponent } from '../../../../test-utils/render-component';
import { CwdToolbarComponent } from '../cwd-toolbar/cwd-toolbar.component';
import { CwdToolbarActionItemComponent } from './cwd-toolbar-action-item.component';

// The host's template is set with overrideTemplate in the test, so it is
// compiled against the test module, where the toolbar components are declared.
@Component({ template: '', standalone: false })
class ToolbarHost {}

const hostTemplate = `
    <cas-cwd-toolbar></cas-cwd-toolbar>
    <cas-cwd-toolbar-action-item selector="#toolbar-action">
      <button type="button">Run Plan</button>
    </cas-cwd-toolbar-action-item>
  `;

describe('CwdToolbarActionItemComponent', () => {
  /**
   * Verifies: the item's content is moved into the element its selector names.
   * Interacts with: the real CwdToolbarComponent and the CDK DomPortalOutlet.
   * Data: selector #toolbar-action; a Run Plan button as the item's content.
   */
  it('portals its content into the selected outlet', async () => {
    const { container } = await renderComponent(ToolbarHost, {
      declarations: [CwdToolbarComponent, CwdToolbarActionItemComponent],
      imports: [MatToolbarModule, PortalModule],
      configureTestBed: (testBed) =>
        testBed.overrideTemplate(ToolbarHost, hostTemplate),
    });

    expect(container.querySelector('#toolbar-action')).toContainElement(
      screen.getByRole('button', { name: 'Run Plan' }),
    );
  });
});
