// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import {
  declarationSnippet,
  deliveredAs,
  entryCopyText,
  setSnippet,
  variableLabel,
} from './environment-set-snippets';

describe('environment set snippets', () => {
  /**
   * Verifies: a Terraform variable is labelled as written in code, an environment variable by its name.
   * Data: one of each kind.
   */
  it('labels variables as they are written', () => {
    expect(
      variableLabel({ kind: 'TerraformVariable', targetName: 'region' }),
    ).toBe('var.region');
    expect(
      variableLabel({
        kind: 'EnvironmentVariable',
        targetName: 'VSPHERE_USER',
      }),
    ).toBe('VSPHERE_USER');
    expect(
      deliveredAs({ kind: 'TerraformVariable', targetName: 'region' }),
    ).toContain('TF_VAR_region');
  });

  /**
   * Verifies: a secret Terraform variable is declared sensitive and ephemeral.
   * Data: a secret vsphere_password.
   */
  it('declares a secret Terraform variable as ephemeral', () => {
    const snippet = declarationSnippet({
      kind: 'TerraformVariable',
      targetName: 'vsphere_password',
      valueSource: 'Secret',
    });

    expect(snippet).toContain('variable "vsphere_password" {');
    expect(snippet).toContain('type = string');
    expect(snippet).toContain('sensitive = true');
    expect(snippet).toContain('ephemeral = true');
  });

  /**
   * Verifies: a plain map-looking value gets a complex type with a note to check it, as Terraform parses TF_VAR_ HCL only for complex types.
   * Data: tags = { team = "blue" }.
   */
  it('gives a map-looking value a type to check', () => {
    const snippet = declarationSnippet({
      kind: 'TerraformVariable',
      targetName: 'tags',
      valueSource: 'Plain',
      value: '{ team = "blue" }',
    });

    expect(snippet).toContain('type = map(string) # Check');
    expect(snippet).not.toContain('ephemeral');
  });

  /**
   * Verifies: an environment variable needs no declaration, so Copy copies its name.
   * Data: PROXMOX_VE_API_TOKEN.
   */
  it('copies an environment variable by name', () => {
    const entry = {
      kind: 'EnvironmentVariable' as const,
      targetName: 'PROXMOX_VE_API_TOKEN',
      valueSource: 'Secret' as const,
    };

    expect(declarationSnippet(entry)).toBeNull();
    expect(entryCopyText(entry)).toBe('PROXMOX_VE_API_TOKEN');
  });

  /**
   * Verifies: a set's snippet lists its environment variables in a comment and declares its Terraform variables.
   * Data: one secret env var, one plain Terraform variable.
   */
  it('builds a snippet for a whole set', () => {
    const snippet = setSnippet({
      name: 'Proxmox',
      entries: [
        {
          kind: 'EnvironmentVariable',
          targetName: 'PROXMOX_VE_API_TOKEN',
          valueSource: 'Secret',
        },
        {
          kind: 'TerraformVariable',
          targetName: 'node',
          valueSource: 'Plain',
          value: 'pve1',
        },
      ],
    });

    expect(snippet).toContain('# Environment Set "Proxmox"');
    expect(snippet).toContain('#   PROXMOX_VE_API_TOKEN (secret)');
    expect(snippet).toContain('variable "node" {');
  });
});
