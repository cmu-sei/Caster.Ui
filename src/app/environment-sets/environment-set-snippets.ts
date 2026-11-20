// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
} from '../generated/caster-api';

/** What both entry views (admin and member) share. */
export interface EntryLike {
  kind?: EnvironmentSetEntryKind;
  targetName?: string | null;
  valueSource?: EnvironmentSetValueSource;
  value?: string | null;
}

export interface SetLike {
  name?: string | null;
  entries?: EntryLike[] | null;
}

const isTerraformVariable = (entry: EntryLike) =>
  entry.kind === EnvironmentSetEntryKind.TerraformVariable;

const isSecret = (entry: EntryLike) =>
  entry.valueSource === EnvironmentSetValueSource.Secret;

/** The name as written in Terraform: `var.region`, or `VSPHERE_PASSWORD` for an environment variable. */
export function variableLabel(entry: EntryLike): string {
  return isTerraformVariable(entry)
    ? `var.${entry.targetName}`
    : (entry.targetName ?? '');
}

/** How the value reaches the run. */
export function deliveredAs(entry: EntryLike): string {
  return isTerraformVariable(entry)
    ? `Delivered to the run as the environment variable TF_VAR_${entry.targetName}`
    : `Delivered to the run as the environment variable ${entry.targetName}`;
}

export function kindLabel(entry: EntryLike): string {
  return isTerraformVariable(entry)
    ? 'Terraform variable'
    : 'Environment variable';
}

/**
 * Terraform parses a TF_VAR_ value as HCL only when the variable declares a complex type,
 * so a value that looks like a map or list needs one. Caster cannot know the exact type.
 */
function typeOf(entry: EntryLike): { type: string; guessed: boolean } {
  const value = (entry.value ?? '').trim();

  if (!isSecret(entry) && value.startsWith('{')) {
    return { type: 'map(string)', guessed: true };
  }

  if (!isSecret(entry) && value.startsWith('[')) {
    return { type: 'list(string)', guessed: true };
  }

  return { type: 'string', guessed: false };
}

/** The declaration a Terraform variable entry needs; null for an environment variable, which needs none. */
export function declarationSnippet(entry: EntryLike): string | null {
  if (!isTerraformVariable(entry)) {
    return null;
  }

  const { type, guessed } = typeOf(entry);
  const lines = [`variable "${entry.targetName}" {`];

  if (guessed) {
    lines.push(
      `  type = ${type} # Check: use the type of the value in the Environment Set`,
    );
  } else {
    lines.push(`  type = ${type}`);
  }

  if (isSecret(entry)) {
    lines.push('  sensitive = true');
    lines.push(
      '  ephemeral = true # Terraform 1.10+: keeps the value out of state and plan files; use only in provider blocks',
    );
  }

  lines.push('}');

  return lines.join('\n');
}

/** What Copy puts on the clipboard for one entry. */
export function entryCopyText(entry: EntryLike): string {
  return declarationSnippet(entry) ?? entry.targetName ?? '';
}

/**
 * Every declaration a set needs, after a comment naming the environment variables it
 * provides, which providers read without any code.
 */
export function setSnippet(set: SetLike): string {
  const entries = set.entries ?? [];
  const environment = entries.filter((x) => !isTerraformVariable(x));
  const terraform = entries.filter(isTerraformVariable);
  const lines = [`# Environment Set "${set.name}"`];

  if (environment.length) {
    lines.push(
      '# Environment variables, read by providers with no declaration needed:',
    );
    for (const entry of environment) {
      lines.push(
        `#   ${entry.targetName}${isSecret(entry) ? ' (secret)' : ''}`,
      );
    }
  }

  if (terraform.length) {
    lines.push('');
    lines.push(terraform.map((x) => declarationSnippet(x)).join('\n\n'));
  }

  return lines.join('\n') + '\n';
}
