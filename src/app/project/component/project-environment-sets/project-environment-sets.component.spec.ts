// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import {
  EnvironmentSetsService,
  ProjectEnvironmentSet,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectEnvironmentSetsComponent } from './project-environment-sets.component';

const projectSets: ProjectEnvironmentSet[] = [
  {
    environmentSetId: 's1',
    projectId: 'p1',
    name: 'vSphere',
    description: 'vCenter credentials',
    isComplete: false,
    entries: [
      {
        id: 'e1',
        kind: 'EnvironmentVariable',
        targetName: 'VSPHERE_USER',
        valueSource: 'Plain',
        value: 'administrator@vsphere.local',
        isAvailable: true,
      },
      {
        id: 'e2',
        kind: 'EnvironmentVariable',
        targetName: 'VSPHERE_PASSWORD',
        valueSource: 'Secret',
        value: null,
        isAvailable: false,
      },
    ],
  },
];

async function renderPanel(sets: ProjectEnvironmentSet[]) {
  const { dialogRef, close } = dialogRefStub<ProjectEnvironmentSetsComponent>();
  const api = {
    getProjectEnvironmentSets: vi.fn(() => of(structuredClone(sets))),
  } satisfies ApiStub<EnvironmentSetsService>;
  const view = await renderComponent(ProjectEnvironmentSetsComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS, A11yModule],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { projectId: 'p1', projectName: 'Range A' },
      },
      { provide: EnvironmentSetsService, useValue: api },
    ],
  });

  return { ...view, api, close };
}

describe('ProjectEnvironmentSetsComponent', () => {
  /**
   * Verifies: members see the set, its plain values, and that a secret is missing, with no source name.
   * Interacts with: getProjectEnvironmentSets (stub), real EnvironmentSetService.
   * Data: one incomplete set with a plain user and a missing secret password.
   */
  it('shows the sets, plain values and secret status', async () => {
    const { api } = await renderPanel(projectSets);

    expect(api.getProjectEnvironmentSets).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('heading', { name: /vSphere/ })).toHaveTextContent(
      /Incomplete/,
    );
    expect(screen.getByText('administrator@vsphere.local')).toBeInTheDocument();
    expect(screen.getByText('VSPHERE_PASSWORD')).toBeInTheDocument();
    expect(screen.getByText(/Secret, missing/)).toBeInTheDocument();
  });

  /**
   * Verifies: a SignalR update to the project's sets reaches the open panel.
   * Interacts with: EnvironmentSetService.projectSetsUpdated (real).
   * Data: the project starts with no sets; one is assigned while the panel is open.
   */
  it('updates live when a set is assigned', async () => {
    const { fixture } = await renderPanel([]);
    expect(
      screen.getByText('No Environment Sets are assigned to this project.'),
    ).toBeInTheDocument();

    TestBed.inject(EnvironmentSetService).projectSetsUpdated('p1', projectSets);
    fixture.detectChanges();

    expect(screen.getByText('administrator@vsphere.local')).toBeInTheDocument();
  });
});
