// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

export class ValidatorPatterns {
  public static WorkspaceName = '^[a-zA-Z0-9-_.]+$';
  // Terraform block labels, such as a module instance name.
  public static TerraformName = '^[a-zA-Z_][a-zA-Z0-9_-]*$';
  public static Guid =
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
}

// Turns a display name such as "Router / Gateway" into a valid Terraform name ("Router_Gateway").
export function toTerraformName(name: string): string {
  const cleaned = (name ?? '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_');
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : '_' + cleaned;
}
