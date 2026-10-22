// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatTooltipModule } from '@angular/material/tooltip';
import { renderComponent } from '../../../test-utils/render-component';
import { WorkspaceVersionComponent } from './workspace-version.component';

describe('WorkspaceVersionComponent', () => {
  /**
   * Verifies: the workspace's Terraform version is shown.
   * Interacts with: the workspace input.
   * Data: workspace on Terraform 1.5.7.
   */
  it('shows the Terraform version', async () => {
    await renderComponent(WorkspaceVersionComponent, {
      imports: [MatTooltipModule],
      inputs: { workspace: { id: 'w1', terraformVersion: '1.5.7', runs: [] } },
    });

    expect(screen.getByText('1.5.7')).toBeInTheDocument();
  });
});
