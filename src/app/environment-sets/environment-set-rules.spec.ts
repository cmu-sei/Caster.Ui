// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ConnectionField,
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
} from '../generated/caster-api';
import {
  apiErrorMessage,
  matchesSecretPatterns,
  secretTerraformVariableError,
  targetNameError,
} from './environment-set-rules';

const ENV = EnvironmentSetEntryKind.EnvironmentVariable;
const TF = EnvironmentSetEntryKind.TerraformVariable;

describe('environment set rules', () => {
  /**
   * Verifies: the environment variable targets caster.api allows pass.
   * Data: provider credentials, a registry token, a name starting HOME.
   */
  it.each(['AWS_ACCESS_KEY_ID', '_x', 'TF_TOKEN_app_terraform_io', 'HOMEDIR'])(
    'allows the environment variable %s',
    (name) => {
      expect(targetNameError(ENV, name)).toBeNull();
    },
  );

  /**
   * Verifies: Terraform's own controls, TF_VAR_, HOME, PATH and malformed names are refused.
   * Data: one refused name per row.
   */
  it.each([
    'TF_CLI_ARGS',
    'TF_DATA_DIR',
    'tf_log',
    'TF_VAR_x',
    'HOME',
    'path',
    '1A',
    'A-B',
    '',
  ])('refuses the environment variable "%s"', (name) => {
    expect(targetNameError(ENV, name)).not.toBeNull();
  });

  /**
   * Verifies: Terraform variable names follow Terraform's identifier rules.
   * Data: a hyphenated name passes, one starting with a digit does not.
   */
  it('checks Terraform variable names', () => {
    expect(targetNameError(TF, 'vsphere-password')).toBeNull();
    expect(targetNameError(TF, '2fa')).not.toBeNull();
  });

  /**
   * Verifies: a secret source must be an environment variable name matching a pattern.
   * Data: the shipped pattern ^CASTER_SECRET_.
   */
  it('matches secret sources against the patterns', () => {
    expect(matchesSecretPatterns('CASTER_SECRET_X', ['^CASTER_SECRET_'])).toBe(
      true,
    );
    expect(
      matchesSecretPatterns('ConnectionStrings__PostgreSQL', [
        '^CASTER_SECRET_',
      ]),
    ).toBe(false);
    expect(matchesSecretPatterns('CASTER_SECRET_X', [])).toBe(false);
  });

  /**
   * Verifies: a secret, or a connection credential, can't be a Terraform variable; a plain value or a non-secret field can.
   * Data: each kind with Secret, Plain, and Connection credential and non-credential fields.
   */
  it('refuses secrets as Terraform variables', () => {
    const { Secret, Plain, Connection } = EnvironmentSetValueSource;
    expect(secretTerraformVariableError(TF, Secret)).toContain(
      "can't be a Terraform variable",
    );
    expect(
      secretTerraformVariableError(
        TF,
        Connection,
        ConnectionField.ApiTokenSecret,
      ),
    ).not.toBeNull();
    expect(
      secretTerraformVariableError(TF, Connection, ConnectionField.ApiUrl),
    ).toBeNull();
    expect(secretTerraformVariableError(TF, Plain)).toBeNull();
    expect(secretTerraformVariableError(ENV, Secret)).toBeNull();
  });

  /**
   * Verifies: git's numbered configuration can't be set.
   * Data: GIT_CONFIG_COUNT, GIT_CONFIG_KEY_0 and git_config_value_3; GIT_CONFIG_GLOBAL is allowed.
   */
  it("refuses git's numbered configuration", () => {
    for (const name of [
      'GIT_CONFIG_COUNT',
      'GIT_CONFIG_KEY_0',
      'git_config_value_3',
    ]) {
      expect(targetNameError(ENV, name)).toContain('GIT_CONFIG_COUNT');
    }
    expect(targetNameError(ENV, 'GIT_CONFIG_GLOBAL')).toBeNull();
  });

  /**
   * Verifies: validation errors and problem titles become one readable message.
   * Data: a 400 ValidationProblemDetails and a 409 ProblemDetails.
   */
  it('reads API errors', () => {
    expect(
      apiErrorMessage(
        new HttpErrorResponse({
          status: 400,
          error: { errors: { TargetName: ['Bad name.'] } },
        }),
      ),
    ).toBe('Bad name.');
    expect(
      apiErrorMessage(
        new HttpErrorResponse({
          status: 409,
          error: { title: 'Already set.' },
        }),
      ),
    ).toBe('Already set.');
  });
});
