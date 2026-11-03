// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  MatFormField,
  MatLabel,
  MatError,
  MatHint,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect, MatOption } from '@angular/material/select';
import {
  MatAutocomplete,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatIcon } from '@angular/material/icon';
import { startWith } from 'rxjs/operators';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetEntry,
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import {
  apiErrorMessage,
  matchesSecretPatterns,
  secretTerraformVariableWarning,
  targetNameError,
} from 'src/app/environment-sets/environment-set-rules';

export interface EnvironmentSetEntryDialogData {
  set: EnvironmentSet;
  /** The entry to edit; absent to add one. */
  entry?: EnvironmentSetEntry;
  secrets: EnvironmentSecrets | null;
}

/** Adds or edits one entry. Saves itself, so an API refusal is shown here rather than lost. */
@Component({
  selector: 'cas-environment-set-entry-dialog',
  templateUrl: './environment-set-entry-dialog.component.html',
  styleUrls: ['./environment-set-entry-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatIcon,
  ],
})
export class EnvironmentSetEntryDialogComponent {
  readonly data = inject<EnvironmentSetEntryDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<EnvironmentSetEntryDialogComponent>);
  private formBuilder = inject(NonNullableFormBuilder);
  private environmentSetService = inject(EnvironmentSetService);

  readonly Kind = EnvironmentSetEntryKind;
  readonly Source = EnvironmentSetValueSource;
  readonly isEdit = !!this.data.entry;
  readonly title = this.isEdit
    ? `Edit Entry in ${this.data.set.name}`
    : `Add Entry to ${this.data.set.name}`;
  readonly patterns = this.data.secrets?.patterns ?? [];
  readonly availableSecrets = this.data.secrets?.available ?? [];

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    kind: [
      this.data.entry?.kind ?? EnvironmentSetEntryKind.EnvironmentVariable,
    ],
    targetName: [this.data.entry?.targetName ?? ''],
    valueSource: [
      this.data.entry?.valueSource ?? EnvironmentSetValueSource.Secret,
    ],
    secretName: [this.data.entry?.secretName ?? ''],
    value: [this.data.entry?.value ?? ''],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  constructor() {
    const controls = this.form.controls;

    controls.targetName.addValidators((c) => this.targetNameValidator(c));
    controls.secretName.addValidators((c) =>
      this.isSecret() ? this.secretNameValidator(c) : null,
    );

    // A change of kind or source changes what the other fields must be.
    controls.kind.valueChanges.subscribe(() =>
      controls.targetName.updateValueAndValidity(),
    );
    controls.valueSource.valueChanges.subscribe(() =>
      controls.secretName.updateValueAndValidity(),
    );
  }

  isSecret(): boolean {
    return (
      this.form.controls.valueSource.value === EnvironmentSetValueSource.Secret
    );
  }

  warning(): string | null {
    const value = this.formValue();
    return secretTerraformVariableWarning(
      value.kind,
      value.valueSource,
      this.data.secrets?.runMode,
    );
  }

  filteredSecrets(): string[] {
    const typed = (this.formValue().secretName ?? '').toUpperCase();
    return this.availableSecrets.filter((x) => x.toUpperCase().includes(typed));
  }

  secretUnavailable(): boolean {
    const name = this.formValue().secretName;
    return (
      this.isSecret() &&
      !!name &&
      this.form.controls.secretName.valid &&
      !this.availableSecrets.includes(name)
    );
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const { kind, targetName, valueSource, secretName, value } =
      this.form.getRawValue();
    const command = {
      kind,
      targetName: targetName.trim(),
      valueSource,
      secretName:
        valueSource === EnvironmentSetValueSource.Secret
          ? secretName.trim()
          : null,
      value: valueSource === EnvironmentSetValueSource.Plain ? value : null,
    };

    const request = this.isEdit
      ? this.environmentSetService.editEntry(
          this.data.set.id,
          this.data.entry.id,
          command,
        )
      : this.environmentSetService.createEntry(this.data.set.id, command);

    this.saving.set(true);
    this.error.set(null);

    request.subscribe({
      next: (set) => this.dialogRef.close(set),
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  private targetNameValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
    const error = targetNameError(
      this.form?.controls.kind.value ??
        EnvironmentSetEntryKind.EnvironmentVariable,
      (control.value ?? '').trim(),
    );
    return error ? { targetName: error } : null;
  }

  private secretNameValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
    const name = (control.value ?? '').trim();

    if (!name) {
      return { required: true };
    }

    return matchesSecretPatterns(name, this.patterns)
      ? null
      : { pattern: true };
  }
}
