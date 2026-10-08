// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatToolbarModule } from '@angular/material/toolbar';
import { renderComponent } from '../../../../test-utils/render-component';
import { CwdToolbarComponent } from './cwd-toolbar.component';

describe('CwdToolbarComponent', () => {
  /**
   * Verifies: the toolbar renders its title and the navigation and action outlets the toolbar items portal into.
   * Interacts with: getDefaultProviders (placeholders and stubs only).
   * Data: none.
   */
  it('renders the title and the item outlets', async () => {
    const { container } = await renderComponent(CwdToolbarComponent, {
      imports: [MatToolbarModule],
    });

    expect(screen.getByText('Caster')).toBeInTheDocument();
    expect(container.querySelector('#toolbar-navigation')).not.toBeNull();
    expect(container.querySelector('#toolbar-action')).not.toBeNull();
  });
});
