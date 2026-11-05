// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';

/**
 * Asks for what to add or update, the way the External Module ID box did: a
 * source name syncs that source, name/subdirectory adds one Module from it, and
 * a number is a GitLab project ID. Closes with the trimmed value.
 */
@Component({
  selector: 'cas-add-module-dialog',
  templateUrl: './add-module-dialog.component.html',
  styleUrls: ['./add-module-dialog.component.css'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatError,
  ],
})
export class AddModuleDialogComponent {
  private dialogRef = inject(MatDialogRef<AddModuleDialogComponent, string>);
  private formBuilder = inject(NonNullableFormBuilder);

  public form = this.formBuilder.group({
    externalModuleId: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  get externalModuleId() {
    return this.form.controls.externalModuleId;
  }

  onSubmit(): void {
    this.dialogRef.close(this.externalModuleId.value.trim());
  }
}
