// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { HttpErrorResponse } from '@angular/common/http';
import {
  ConnectionField,
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
} from '../generated/caster-api';

const ENVIRONMENT_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TERRAFORM_VARIABLE_NAME = /^[A-Za-z_-][A-Za-z0-9_-]*$/;
const RESERVED = ['HOME', 'PATH'];
const GIT_CONFIG = /^GIT_CONFIG_(COUNT|KEY_[0-9]+|VALUE_[0-9]+)$/i;
const SECRET_FIELDS: ConnectionField[] = [
  ConnectionField.Password,
  ConnectionField.ApiToken,
  ConnectionField.ApiTokenId,
  ConnectionField.ApiTokenSecret,
];

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

  if (GIT_CONFIG.test(name)) {
    return "GIT_CONFIG_COUNT, GIT_CONFIG_KEY_n and GIT_CONFIG_VALUE_n cannot be set: they would replace or renumber Caster's own git configuration.";
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

/** Whether a connection field is a credential: secret, masked, never a Terraform variable. */
export function isSecretField(
  field: ConnectionField | null | undefined,
): boolean {
  return !!field && SECRET_FIELDS.includes(field);
}

/** Whether an entry's value is a secret: a Secret entry, or a connection credential. */
export function isSecretSource(
  valueSource: EnvironmentSetValueSource,
  field?: ConnectionField | null,
): boolean {
  return (
    valueSource === EnvironmentSetValueSource.Secret ||
    (valueSource === EnvironmentSetValueSource.Connection &&
      isSecretField(field))
  );
}

/**
 * Why an entry can't be saved because it would make a secret a Terraform variable, or
 * null. Terraform saves variable values in plans and state, so the API refuses it too.
 */
export function secretTerraformVariableError(
  kind: EnvironmentSetEntryKind,
  valueSource: EnvironmentSetValueSource,
  field?: ConnectionField | null,
): string | null {
  return kind === EnvironmentSetEntryKind.TerraformVariable &&
    isSecretSource(valueSource, field)
    ? "A secret can't be a Terraform variable: Terraform saves variables in plans and state. Use an environment variable, as provider credentials are."
    : null;
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

/** Why a connection entry can't be changed: the API needs ManageInfrastructure for it. */
export const connectionEntryLockedText =
  'Changing a connection entry needs permission to manage connections';
