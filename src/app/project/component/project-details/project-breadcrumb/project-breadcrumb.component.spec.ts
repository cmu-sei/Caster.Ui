// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { renderComponent } from 'src/app/test-utils/render-component';
import { Breadcrumb, ProjectObjectType } from '../../../state/project.model';
import { ProjectBreadcrumbComponent } from './project-breadcrumb.component';

const breadcrumbs: Breadcrumb[] = [
  { id: 'd1', name: 'network', type: ProjectObjectType.DIRECTORY },
  { id: 'f1', name: 'main.tf', type: ProjectObjectType.FILE },
];

describe('ProjectBreadcrumbComponent', () => {
  /**
   * Verifies: in button style each breadcrumb is a button that emits itself when clicked.
   * Interacts with: the buttonClick output.
   * Data: breadcrumbs network > main.tf; button style; main.tf clicked.
   */
  it('emits the clicked breadcrumb in button style', async () => {
    const buttonClick = vi.fn<(b: Breadcrumb) => void>();
    await renderComponent(ProjectBreadcrumbComponent, {
      imports: [MatButtonModule, MatIconModule],
      inputs: { breadcrumbs, useButtonStyleBreadcrumbs: true },
      on: { buttonClick },
    });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'main.tf' }));

    expect(buttonClick).toHaveBeenCalledWith(breadcrumbs[1]);
  });

  /**
   * Verifies: in plain style the breadcrumbs render as text, without buttons.
   * Interacts with: the @if (!useButtonStyleBreadcrumbs) block.
   * Data: breadcrumbs network > main.tf; plain style.
   */
  it('renders plain breadcrumbs as text', async () => {
    await renderComponent(ProjectBreadcrumbComponent, {
      imports: [MatButtonModule, MatIconModule],
      inputs: { breadcrumbs, useButtonStyleBreadcrumbs: false },
    });

    expect(screen.getByText('network')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });
});
