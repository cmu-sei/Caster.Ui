// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { A11yModule } from '@angular/cdk/a11y';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { of, throwError } from 'rxjs';
import {
  EnvironmentSet,
  EnvironmentSetsService,
  Project,
  ProjectsService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AssignProjectDialogComponent } from './assign-project-dialog.component';

const set: EnvironmentSet = {
  id: 's1',
  name: 'vSphere',
  projects: [{ projectId: 'p1', name: 'Range A' }],
};

const projects: Project[] = [
  { id: 'p1', name: 'Range A' },
  { id: 'p2', name: 'Range B' },
];

async function renderDialog(api: ApiStub<EnvironmentSetsService>) {
  const { dialogRef, close } = dialogRefStub<AssignProjectDialogComponent>();
  const view = await renderComponent(AssignProjectDialogComponent, {
    imports: [
      AssignProjectDialogComponent,
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatFormFieldModule,
      MatSelectModule,
      A11yModule,
    ],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { set } },
      {
        provide: ProjectsService,
        useValue: {
          getAllProjects: vi.fn(() => of(projects)),
        } satisfies ApiStub<ProjectsService>,
      },
      { provide: EnvironmentSetsService, useValue: api },
    ],
  });
  const select = await TestbedHarnessEnvironment.loader(
    view.fixture,
  ).getHarness(MatSelectHarness);

  return { ...view, close, select, user: userEvent.setup() };
}

describe('AssignProjectDialogComponent', () => {
  /**
   * Verifies: only the projects the set is not already on are offered.
   * Interacts with: ProjectsService.getAllProjects (stub); the project select.
   * Data: the set is on Range A; Range A and Range B exist.
   */
  it('offers only the projects without the set', async () => {
    const { select } = await renderDialog({});

    await select.open();
    const options = await select.getOptions();

    expect(await Promise.all(options.map((x) => x.getText()))).toEqual([
      'Range B',
    ]);
  });

  /**
   * Verifies: a conflict from the API is shown in the dialog, which stays open.
   * Interacts with: assignEnvironmentSet (stub answering 409).
   * Data: Range B already gets REGION from another set.
   */
  it('shows a conflict and stays open', async () => {
    const { select, user, close } = await renderDialog({
      assignEnvironmentSet: vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { title: 'REGION is already set on project "Range B".' },
            }),
        ),
      ),
    });

    await select.open();
    await select.clickOptions({ text: 'Range B' });
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'REGION is already set on project "Range B".',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
