// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  DeploymentLimits,
  deploymentLimitsForm,
  deploymentLimitsValue,
} from './deployment-limits';
import { DeploymentLimitsFieldsComponent } from './deployment-limits-fields.component';

export interface DeploymentLimitsDialogData {
  title: string;
  limits: DeploymentLimits;
}

/** Edits a project's deployment limits. Closes with the limits, or nothing when cancelled. */
@Component({
  selector: 'cas-deployment-limits-dialog',
  template: `
    <crucible-dialog
      [dialogTitle]="data.title"
      [form]="form"
      submitLabel="Save"
      [submitDisabled]="!form.valid || !form.dirty"
      [guardUnsavedWork]="true"
      (submit)="save()"
    >
      <div crucibleDialogContent>
        <p class="dialog-message">
          Each workspace in the project is held to these, and to any lower limit
          of its own or in the global settings.
        </p>
        <cas-deployment-limits-fields [form]="form" />
      </div>
    </crucible-dialog>
  `,
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    DeploymentLimitsFieldsComponent,
  ],
})
export class DeploymentLimitsDialogComponent {
  readonly data = inject<DeploymentLimitsDialogData>(MAT_DIALOG_DATA);
  private dialogRef =
    inject<MatDialogRef<DeploymentLimitsDialogComponent>>(MatDialogRef);

  readonly form = deploymentLimitsForm(this.data.limits);

  save() {
    this.dialogRef.close(deploymentLimitsValue(this.form));
  }
}
