// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import {
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
  TerraformRunMode,
} from '../generated/caster-api';
import {
  apiErrorMessage,
  matchesSecretPatterns,
  secretTerraformVariableWarning,
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
   * Verifies: only a secret Terraform variable warns, and the pod log note appears only in Kubernetes mode.
   * Data: each kind and source; both run modes.
   */
  it('warns about secret Terraform variables', () => {
    const secret = EnvironmentSetValueSource.Secret;
    expect(
      secretTerraformVariableWarning(ENV, secret, TerraformRunMode.Kubernetes),
    ).toBeNull();
    expect(
      secretTerraformVariableWarning(
        TF,
        EnvironmentSetValueSource.Plain,
        TerraformRunMode.Kubernetes,
      ),
    ).toBeNull();
    expect(
      secretTerraformVariableWarning(TF, secret, TerraformRunMode.Process),
    ).not.toContain('pod logs');
    expect(
      secretTerraformVariableWarning(TF, secret, TerraformRunMode.Kubernetes),
    ).toContain('pod logs');
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
