// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatDialogModule } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetsService,
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
      isAvailable: false,
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
  } satisfies ApiStub<EnvironmentSetsService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);

  const view = await renderComponent(EnvironmentSetDetailComponent, {
    inputs: { set, canEdit, secrets },
    imports: [MatDialogModule],
    providers: [
      { provide: EnvironmentSetsService, useValue: api },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
  });

  return { ...view, api, confirm, user: userEvent.setup() };
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
    expect(screen.getByText('TF_VAR_vsphere_password')).toBeInTheDocument();
    expect(
      screen.getByText('CASTER_SECRET_VSPHERE_PASSWORD'),
    ).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  /**
   * Verifies: a secret Terraform variable carries the pod log warning in Kubernetes job mode.
   * Interacts with: the warning icon's accessible name.
   * Data: vsphere_password, a secret Terraform variable; run mode Kubernetes.
   */
  it('warns about the secret Terraform variable', async () => {
    await renderDetail(false);

    expect(screen.getByLabelText(/pod logs/)).toBeInTheDocument();
  });

  /**
   * Verifies: without edit rights there are no entry or assignment controls.
   * Interacts with: canEdit input.
   * Data: canEdit false.
   */
  it('hides the controls for a read-only caller', async () => {
    await renderDetail(false);

    expect(screen.queryByRole('button', { name: 'Add Entry' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Assign to Project' }),
    ).toBeNull();
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
});
