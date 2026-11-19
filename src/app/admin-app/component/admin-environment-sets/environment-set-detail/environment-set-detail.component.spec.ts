// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatDialogModule } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import {
  AssignmentsService,
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetsService,
  ProjectGroupsService,
  ProjectsService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { EnvironmentSetDetailComponent } from './environment-set-detail.component';

const set: EnvironmentSet = {
  id: 's1',
  name: 'vSphere',
  isComplete: false,
  entries: [
    {
      id: 'e1',
      environmentSetId: 's1',
      kind: 'EnvironmentVariable',
      targetName: 'VSPHERE_USER',
      valueSource: 'Plain',
      value: 'administrator@vsphere.local',
      isAvailable: true,
    },
    {
      id: 'e2',
      environmentSetId: 's1',
      kind: 'TerraformVariable',
      targetName: 'vsphere_password',
      valueSource: 'Secret',
      secretName: 'CASTER_SECRET_VSPHERE_PASSWORD',
      isSecret: true,
      isAvailable: false,
      unavailable:
        "it is a secret, and a secret can't be a Terraform variable: Terraform saves variables in plans and state.",
    },
    {
      id: 'e3',
      environmentSetId: 's1',
      kind: 'EnvironmentVariable',
      targetName: 'VSPHERE_SERVER',
      valueSource: 'Connection',
      connectionName: 'lab-vcenter',
      connectionField: 'Host',
      isAvailable: true,
    },
  ],
  projects: [{ projectId: 'p1', name: 'Range A' }],
};

const secrets: EnvironmentSecrets = {
  available: [],
  missing: ['CASTER_SECRET_VSPHERE_PASSWORD'],
  patterns: ['^CASTER_SECRET_'],
  runMode: 'Kubernetes',
  inheritAll: false,
};

async function renderDetail(canEdit: boolean, confirmAnswer?: boolean) {
  const api = {
    unassignEnvironmentSet: vi.fn(() => of<unknown>(null)),
    getEnvironmentSet: vi.fn(() => of({ ...set, projects: [] })),
    getProjectEnvironmentSets: vi.fn(() => of([])),
  } satisfies ApiStub<EnvironmentSetsService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const projects = {
    getAllProjects: vi.fn(() =>
      of([
        { id: 'p1', name: 'Range A' },
        { id: 'p2', name: 'Range B' },
      ]),
    ),
  };
  const assignments = { editAssignments: vi.fn(() => of<unknown>(null)) };
  const projectGroups = {
    getProjectGroups: vi.fn(() => of([{ id: 'g1', name: 'Lab' }])),
  };

  const view = await renderComponent(EnvironmentSetDetailComponent, {
    inputs: { set, canEdit, secrets },
    imports: [MatDialogModule],
    providers: [
      { provide: EnvironmentSetsService, useValue: api },
      { provide: ProjectsService, useValue: projects },
      { provide: AssignmentsService, useValue: assignments },
      { provide: ProjectGroupsService, useValue: projectGroups },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
  });

  return { ...view, api, assignments, confirm, user: userEvent.setup() };
}

describe('EnvironmentSetDetailComponent', () => {
  /**
   * Verifies: each entry shows the name it sets in the run, the plain value or the secret source, and whether it is available.
   * Interacts with: the entries table.
   * Data: a plain env var and a missing secret Terraform variable.
   */
  it('lists the entries with their sources and status', async () => {
    await renderDetail(false);

    expect(screen.getByText('VSPHERE_USER')).toBeInTheDocument();
    expect(screen.getByText('administrator@vsphere.local')).toBeInTheDocument();
    expect(screen.getByText('var.vsphere_password')).toBeInTheDocument();
    expect(
      screen.getByText('CASTER_SECRET_VSPHERE_PASSWORD'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('lab-vcenter')).toBeInTheDocument();
  });

  /**
   * Verifies: an entry a run can't use says why.
   * Interacts with: the Unavailable label's accessible name.
   * Data: vsphere_password, a secret Terraform variable saved before the rule.
   */
  it('says why an entry is unavailable', async () => {
    await renderDetail(false);

    expect(
      screen.getByLabelText(/can't be a Terraform variable/),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a connection entry can't be edited without ManageInfrastructure, but can be deleted.
   * Interacts with: the entry's Edit and Delete buttons.
   * Data: VSPHERE_SERVER from a connection; canEdit, no canUseConnections.
   */
  it('locks connection entries without ManageInfrastructure', async () => {
    await renderDetail(true);

    expect(
      screen.getByRole('button', { name: 'Edit VSPHERE_SERVER' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete VSPHERE_SERVER' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Edit VSPHERE_USER' }),
    ).toBeEnabled();
  });

  /**
   * Verifies: without edit rights there are no entry or assignment controls.
   * Interacts with: canEdit input.
   * Data: canEdit false.
   */
  it('hides the controls for a read-only caller', async () => {
    await renderDetail(false);

    expect(screen.queryByRole('button', { name: 'Add Entry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Assign vSphere' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Remove from Range A' }),
    ).toBeNull();
  });

  /**
   * Verifies: removing the set from a project asks first, then unassigns it.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), unassignEnvironmentSet (stub).
   * Data: Range A.
   */
  it('removes the set from a project after confirming', async () => {
    const { user, api, confirm } = await renderDetail(true, true);

    await user.click(
      screen.getByRole('button', { name: 'Remove from Range A' }),
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Remove from Project' }),
    );
    expect(api.unassignEnvironmentSet).toHaveBeenCalledWith('p1', 's1');
  });

  /**
   * Verifies: Assign lists every project and project group with the set's checked, and saves both kinds in one request.
   * Interacts with: ProjectsService.getAllProjects, ProjectGroupsService.getProjectGroups and AssignmentsService.editAssignments (stubs); the real dialog.
   * Data: assigned to Range A; add Range B and the Lab group.
   */
  it('assigns the set to projects and groups in one save', async () => {
    const { user, assignments } = await renderDetail(true);

    await user.click(screen.getByRole('button', { name: 'Assign vSphere' }));
    expect(
      await screen.findByRole('checkbox', { name: /Range A/ }),
    ).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(screen.getByRole('tab', { name: 'Project Groups' }));
    await user.click(screen.getByRole('checkbox', { name: /Lab/ }));
    await user.click(screen.getByRole('button', { name: 'Save 2 changes' }));

    expect(assignments.editAssignments).toHaveBeenCalledWith({
      changes: [
        { operation: 'Add', projectId: 'p2', environmentSetId: 's1' },
        { operation: 'Add', projectGroupId: 'g1', environmentSetId: 's1' },
      ],
    });
  });
});
