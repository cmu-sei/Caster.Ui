// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { A11yModule } from '@angular/cdk/a11y';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { of, throwError } from 'rxjs';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetsService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  EnvironmentSetEntryDialogComponent,
  EnvironmentSetEntryDialogData,
} from './environment-set-entry-dialog.component';

const set: EnvironmentSet = { id: 's1', name: 'vSphere', entries: [] };

function secrets(
  runMode: 'Process' | 'Kubernetes' = 'Process',
): EnvironmentSecrets {
  return {
    available: ['CASTER_SECRET_VSPHERE_PASSWORD'],
    missing: [],
    patterns: ['^CASTER_SECRET_'],
    runMode,
    inheritAll: false,
  };
}

async function renderDialog(
  data: Partial<EnvironmentSetEntryDialogData> = {},
  api: ApiStub<EnvironmentSetsService> = {},
) {
  const { dialogRef, close } =
    dialogRefStub<EnvironmentSetEntryDialogComponent>();
  const environmentSetsApi = {
    createEnvironmentSetEntry: vi.fn(() => of<EnvironmentSet>(set)),
    ...api,
  } satisfies ApiStub<EnvironmentSetsService>;

  const rendered = await renderComponent(EnvironmentSetEntryDialogComponent, {
    imports: [
      EnvironmentSetEntryDialogComponent,
      ...CRUCIBLE_DIALOG_IMPORTS,
      MatFormFieldModule,
      MatInputModule,
      MatSelectModule,
      MatAutocompleteModule,
      A11yModule,
    ],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { set, secrets: secrets(), ...data },
      },
      { provide: EnvironmentSetsService, useValue: environmentSetsApi },
    ],
  });
  const harnesses = TestbedHarnessEnvironment.loader(rendered.fixture);

  return {
    ...rendered,
    close,
    environmentSetsApi,
    harnesses,
    user: userEvent.setup(),
  };
}

async function choose(
  harnesses: Awaited<ReturnType<typeof renderDialog>>['harnesses'],
  label: string,
  option: string,
) {
  const select = await harnesses.getHarness(
    MatSelectHarness.with({ selector: `[formControlName="${label}"]` }),
  );
  await select.open();
  await select.clickOptions({ text: option });
}

describe('EnvironmentSetEntryDialogComponent', () => {
  /**
   * Verifies: a Terraform control variable is refused with the reason, and Add stays disabled.
   * Interacts with: the target name input and its mat-error; submitDisabled.
   * Data: TF_CLI_ARGS as an environment variable.
   */
  it('refuses a TF_ environment variable', async () => {
    const { user } = await renderDialog();

    await user.type(
      screen.getByLabelText('Environment variable name'),
      'TF_CLI_ARGS',
    );
    await user.tab();

    expect(
      screen.getByText(/control Terraform itself and cannot be set/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  /**
   * Verifies: a secret source that does not match the patterns is refused.
   * Interacts with: the secret source input and its mat-error.
   * Data: ConnectionStrings__PostgreSQL, the API's own connection string.
   */
  it('refuses a secret source outside the patterns', async () => {
    const { user } = await renderDialog();

    await user.type(
      screen.getByLabelText('Environment variable name'),
      'TOKEN',
    );
    await user.type(
      screen.getByLabelText('Secret source'),
      'ConnectionStrings__PostgreSQL',
    );
    await user.tab();

    expect(
      screen.getByText(/must match one of the secret patterns/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  /**
   * Verifies: a secret Terraform variable is refused, with the reason, and Add stays disabled.
   * Interacts with: the Kind select; the alert.
   * Data: kind switched to Terraform variable with the default Secret source.
   */
  it('refuses a secret Terraform variable', async () => {
    const { user, harnesses, fixture } = await renderDialog();

    await choose(harnesses, 'kind', 'Terraform variable (TF_VAR_)');
    await user.type(
      screen.getByLabelText('Terraform variable name'),
      'password',
    );
    await user.type(
      screen.getByLabelText('Secret source'),
      'CASTER_SECRET_VSPHERE_PASSWORD',
    );
    fixture.detectChanges();

    expect(screen.getByRole('alert')).toHaveTextContent(
      /can't be a Terraform variable/,
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  /**
   * Verifies: a connection entry sends the connection and field, and a credential field says it is secret.
   * Interacts with: the Value source, Connection and Field selects; createEnvironmentSetEntry (stub).
   * Data: lab-pve's ApiToken as PROXMOX_VE_API_TOKEN.
   */
  it('adds a connection entry', async () => {
    const { user, harnesses, environmentSetsApi } = await renderDialog({
      canUseConnections: true,
      connections: [
        {
          name: 'lab-pve',
          provider: 'proxmox',
          fields: [
            { field: 'Url', isSecret: false, isAvailable: true },
            { field: 'ApiToken', isSecret: true, isAvailable: true },
          ],
          presets: [],
        },
      ],
    });

    await user.type(
      screen.getByLabelText('Environment variable name'),
      'PROXMOX_VE_API_TOKEN',
    );
    await choose(harnesses, 'valueSource', 'Infrastructure connection');
    await choose(harnesses, 'connectionName', 'lab-pve (proxmox)');
    await choose(harnesses, 'connectionField', 'ApiToken (secret)');

    expect(screen.getByText(/A credential: never shown/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(environmentSetsApi.createEnvironmentSetEntry).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        valueSource: 'Connection',
        connectionName: 'lab-pve',
        connectionField: 'ApiToken',
        secretName: null,
        value: null,
      }),
    );
  });

  /**
   * Verifies: a secret too short to mask is warned about.
   * Interacts with: the secret source input; the note.
   * Data: CASTER_SECRET_PIN, listed as too short.
   */
  it('warns about a secret too short to mask', async () => {
    const { user } = await renderDialog({
      secrets: {
        ...secrets(),
        available: ['CASTER_SECRET_PIN'],
        tooShort: ['CASTER_SECRET_PIN'],
        minimumMaskedLength: 8,
      },
    });

    await user.type(screen.getByLabelText('Environment variable name'), 'PIN');
    await user.type(
      screen.getByLabelText('Secret source'),
      'CASTER_SECRET_PIN',
    );

    expect(screen.getByRole('note')).toHaveTextContent(
      /shorter than 8 characters/,
    );
  });

  /**
   * Verifies: Add sends a secret entry with no value and closes with the API's set.
   * Interacts with: EnvironmentSetsService.createEnvironmentSetEntry (stub); MatDialogRef.close.
   * Data: TOKEN read from an available secret.
   */
  it('adds a secret entry and closes', async () => {
    const { user, environmentSetsApi, close } = await renderDialog();

    await user.type(
      screen.getByLabelText('Environment variable name'),
      'TOKEN',
    );
    await user.type(
      screen.getByLabelText('Secret source'),
      'CASTER_SECRET_VSPHERE_PASSWORD',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(environmentSetsApi.createEnvironmentSetEntry).toHaveBeenCalledWith(
      's1',
      {
        kind: 'EnvironmentVariable',
        targetName: 'TOKEN',
        valueSource: 'Secret',
        secretName: 'CASTER_SECRET_VSPHERE_PASSWORD',
        value: null,
        connectionName: null,
        connectionField: null,
      },
    );
    expect(close).toHaveBeenCalledWith(set);
  });

  /**
   * Verifies: an API refusal is shown in the dialog, which stays open.
   * Interacts with: createEnvironmentSetEntry (stub answering 409); the crucible-dialog error line.
   * Data: a plain REGION entry that collides on an assigned project.
   */
  it('shows an API conflict and stays open', async () => {
    const { user, harnesses, close } = await renderDialog(
      {},
      {
        createEnvironmentSetEntry: vi.fn(() =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { title: 'REGION is already set by "aws".' },
              }),
          ),
        ),
      },
    );

    await user.type(
      screen.getByLabelText('Environment variable name'),
      'REGION',
    );
    await choose(harnesses, 'valueSource', 'Plain value');
    await user.type(screen.getByLabelText('Value'), 'east');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'REGION is already set by "aws".',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
