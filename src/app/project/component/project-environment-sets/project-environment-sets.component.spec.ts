// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, input } from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { ProjectEnvironmentSetsViewComponent } from 'src/app/environment-sets/project-environment-sets-view/project-environment-sets-view.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectEnvironmentSetsComponent } from './project-environment-sets.component';

@Component({ selector: 'cas-project-environment-sets-view', template: '' })
class ViewStub {
  readonly projectId = input<string>(undefined);
}

describe('ProjectEnvironmentSetsComponent', () => {
  /**
   * Verifies: the dialog is titled "Environment Sets" alone, shows the project's view, and Close closes it.
   * Interacts with: the view (stub); MatDialogRef.close.
   * Data: project p1.
   */
  it('shows the project view and closes', async () => {
    const { dialogRef, close } =
      dialogRefStub<ProjectEnvironmentSetsComponent>();
    const { fixture } = await renderComponent(ProjectEnvironmentSetsComponent, {
      childStubs: [
        { replace: ProjectEnvironmentSetsViewComponent, with: ViewStub },
      ],
      imports: [...CRUCIBLE_DIALOG_IMPORTS, A11yModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { projectId: 'p1' } },
      ],
    });

    expect(
      screen.getByRole('heading', { name: 'Environment Sets' }),
    ).toBeInTheDocument();
    const view = fixture.debugElement.children[0].query(
      (x) => x.componentInstance instanceof ViewStub,
    );
    expect(view.componentInstance.projectId()).toBe('p1');

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalled();
  });
});
