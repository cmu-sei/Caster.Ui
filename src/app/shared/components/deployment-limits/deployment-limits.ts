// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { FormControl, FormGroup, Validators } from '@angular/forms';

/** The four limits a project or workspace can set. A null is no limit at that level. */
export interface DeploymentLimits {
  maxMachines?: number | null;
  maxVcpu?: number | null;
  maxMemoryGiB?: number | null;
  maxDiskGiB?: number | null;
}

export const deploymentLimitKeys = [
  'maxMachines',
  'maxVcpu',
  'maxMemoryGiB',
  'maxDiskGiB',
] as const;

export type DeploymentLimitsForm = FormGroup<{
  [K in (typeof deploymentLimitKeys)[number]]: FormControl<number | null>;
}>;

/** A form group for the four limits, each a whole number from 0, or empty for no limit. */
export function deploymentLimitsForm(
  limits?: DeploymentLimits | null,
): DeploymentLimitsForm {
  const control = (value?: number | null) =>
    new FormControl<number | null>(value ?? null, [
      Validators.min(0),
      Validators.pattern(/^\d*$/),
    ]);
  return new FormGroup({
    maxMachines: control(limits?.maxMachines),
    maxVcpu: control(limits?.maxVcpu),
    maxMemoryGiB: control(limits?.maxMemoryGiB),
    maxDiskGiB: control(limits?.maxDiskGiB),
  });
}

/** The limits in a form, an empty field as null. */
export function deploymentLimitsValue(
  form: DeploymentLimitsForm,
): DeploymentLimits {
  const value = form.getRawValue();
  const read = (x: number | null | string) =>
    x === null || x === undefined || x === '' ? null : Number(x);
  return {
    maxMachines: read(value.maxMachines),
    maxVcpu: read(value.maxVcpu),
    maxMemoryGiB: read(value.maxMemoryGiB),
    maxDiskGiB: read(value.maxDiskGiB),
  };
}
