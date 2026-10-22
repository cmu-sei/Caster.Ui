// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import { PortalModule } from '@angular/cdk/portal';
import { MatToolbarModule } from '@angular/material/toolbar';
import { renderComponent } from '../../../../test-utils/render-component';
import { CwdToolbarComponent } from '../cwd-toolbar/cwd-toolbar.component';
import { CwdToolbarNavigationItemComponent } from './cwd-toolbar-navigation-item.component';

// The host's template is set with overrideTemplate in the test, so it is
// compiled against the test module, where the toolbar components are declared.
@Component({ template: '', standalone: false })
class ToolbarHost {
  showItem = true;
}

const hostTemplate = `
    <cas-cwd-toolbar></cas-cwd-toolbar>
    @if (showItem) {
      <cas-cwd-toolbar-navigation-item><a href="#">Projects</a></cas-cwd-toolbar-navigation-item>
    }
  `;

describe('CwdToolbarNavigationItemComponent', () => {
  /**
   * Verifies: the item's content is moved into the toolbar's navigation outlet, and removed again when the item is destroyed.
   * Interacts with: the real CwdToolbarComponent and the CDK DomPortalOutlet.
   * Data: a Projects link as the item's content.
   */
  it('portals its content into the toolbar navigation', async () => {
    const { fixture, container } = await renderComponent(ToolbarHost, {
      declarations: [CwdToolbarComponent, CwdToolbarNavigationItemComponent],
      imports: [MatToolbarModule, PortalModule],
      configureTestBed: (testBed) =>
        testBed.overrideTemplate(ToolbarHost, hostTemplate),
    });

    const outlet = container.querySelector(
      '#toolbar-navigation',
    ) as HTMLElement;
    expect(outlet).toContainElement(
      screen.getByRole('link', { name: 'Projects' }),
    );

    fixture.componentInstance.showItem = false;
    fixture.detectChanges();
    expect(
      screen.queryByRole('link', { name: 'Projects' }),
    ).not.toBeInTheDocument();
  });
});
