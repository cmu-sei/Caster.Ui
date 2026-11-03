// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import {
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
  TerraformRunMode,
} from '../generated/caster-api';

const ENVIRONMENT_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TERRAFORM_VARIABLE_NAME = /^[A-Za-z_-][A-Za-z0-9_-]*$/;
const RESERVED = ['HOME', 'PATH'];

/**
 * The target names an entry may set. Mirrors caster.api's EnvironmentSetRules so the
 * form can say what is wrong before saving; the API stays the authority.
 */
export function targetNameError(
  kind: EnvironmentSetEntryKind,
  name: string,
): string | null {
  if (!name) {
    return 'A target name is required.';
  }

  if (kind === EnvironmentSetEntryKind.TerraformVariable) {
    return TERRAFORM_VARIABLE_NAME.test(name)
      ? null
      : 'Terraform variable names may only contain letters, digits, underscores and hyphens, and cannot start with a digit.';
  }

  if (!ENVIRONMENT_VARIABLE_NAME.test(name)) {
    return 'Environment variable names may only contain letters, digits and underscores, and cannot start with a digit.';
  }

  const upper = name.toUpperCase();

  if (upper.startsWith('TF_VAR_')) {
    return 'Use the Terraform variable kind for TF_VAR_ variables, with the name that follows the prefix.';
  }

  if (upper.startsWith('TF_') && !name.startsWith('TF_TOKEN_')) {
    return 'Environment variables starting with TF_ control Terraform itself and cannot be set. TF_TOKEN_* (private registry credentials) is allowed.';
  }

  if (RESERVED.includes(upper)) {
    return 'HOME and PATH cannot be set.';
  }

  return null;
}

/** Whether a secret source name matches one of the API's secret patterns. */
export function matchesSecretPatterns(
  name: string,
  patterns: string[] | null | undefined,
): boolean {
  if (!name || !ENVIRONMENT_VARIABLE_NAME.test(name)) {
    return false;
  }

  return (patterns ?? []).some((pattern) => {
    try {
      return new RegExp(pattern).test(name);
    } catch {
      // A .NET-only construct: let the API decide.
      return true;
    }
  });
}

/**
 * The warning a secret Terraform variable carries, or null. Terraform variable values can
 * reach state, outputs and saved plan files; in Kubernetes job mode they also reach pod
 * logs, because `terraform show -json` prints input variable values.
 */
export function secretTerraformVariableWarning(
  kind: EnvironmentSetEntryKind,
  valueSource: EnvironmentSetValueSource,
  runMode: TerraformRunMode | null | undefined,
): string | null {
  if (
    kind !== EnvironmentSetEntryKind.TerraformVariable ||
    valueSource !== EnvironmentSetValueSource.Secret
  ) {
    return null;
  }

  let warning =
    'Terraform variable values can end up in state, outputs and saved plan files. Prefer a provider environment variable; if a Terraform variable is needed, use it only in provider blocks and declare it ephemeral = true (Terraform 1.10+).';

  if (runMode === TerraformRunMode.Kubernetes) {
    warning +=
      ' In Kubernetes job mode the value is also written to the job pod logs.';
  }

  return warning;
}

/** The effective variable name an entry sets in the run. */
export function effectiveName(
  kind: EnvironmentSetEntryKind,
  targetName: string,
): string {
  return kind === EnvironmentSetEntryKind.TerraformVariable
    ? `TF_VAR_${targetName}`
    : targetName;
}

/** A readable message from an API error, for display inside a dialog. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;

    if (body?.errors) {
      return Object.values(body.errors as Record<string, string[]>)
        .flat()
        .join(' ');
    }

    if (body?.title) {
      return body.detail ? `${body.title} ${body.detail}` : body.title;
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'An error has occurred.';
}
