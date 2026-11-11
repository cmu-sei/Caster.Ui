// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import {
  EnvironmentSet,
  EnvironmentSetConnection,
  EnvironmentSetsService,
} from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CreateFromConnectionDialogComponent } from './create-from-connection-dialog.component';

const connections: EnvironmentSetConnection[] = [
  {
    name: 'lab-pve',
    provider: 'proxmox',
    presets: [{ id: 'bpg/proxmox', name: 'bpg/proxmox' }],
  },
  {
    name: 'lab-vcenter',
    provider: 'vsphere',
    presets: [{ id: 'hashicorp/vsphere', name: 'hashicorp/vsphere' }],
  },
];

async function renderDialog() {
  const { dialogRef } = dialogRefStub<CreateFromConnectionDialogComponent>();
  const api = {
    createEnvironmentSetFromConnection: vi.fn(() =>
      of<EnvironmentSet>({ id: 's1', name: 'lab-vcenter', entries: [] }),
    ),
  };
  const rendered = await renderComponent(CreateFromConnectionDialogComponent, {
    imports: [CreateFromConnectionDialogComponent, ...CRUCIBLE_DIALOG_IMPORTS],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { connections } },
      { provide: EnvironmentSetsService, useValue: api },
    ],
  });
  return {
    ...rendered,
    api,
    harnesses: TestbedHarnessEnvironment.loader(rendered.fixture),
  };
}

describe('CreateFromConnectionDialogComponent', () => {
  /**
   * Verifies: choosing another connection picks that connection's first preset, so the set made is for the connection chosen.
   * Interacts with: EnvironmentSetsService.createEnvironmentSetFromConnection (stub).
   * Data: a Proxmox and a vSphere connection, one preset each.
   */
  it("picks the chosen connection's preset when the connection changes", async () => {
    const { api, harnesses } = await renderDialog();

    const select = await harnesses.getHarness(
      MatSelectHarness.with({ selector: '[formControlName="connectionName"]' }),
    );
    await select.clickOptions({ text: /lab-vcenter/ });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Create' }));

    expect(api.createEnvironmentSetFromConnection).toHaveBeenCalledWith({
      connectionName: 'lab-vcenter',
      preset: 'hashicorp/vsphere',
      name: null,
    });
  });
});
