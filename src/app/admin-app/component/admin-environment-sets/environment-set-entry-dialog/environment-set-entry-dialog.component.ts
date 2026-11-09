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
import { map, startWith } from 'rxjs/operators';
import {
  ConnectionField,
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetConnection,
  EnvironmentSetConnectionField,
  EnvironmentSetEntry,
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import {
  apiErrorMessage,
  isSecretSource,
  matchesSecretPatterns,
  secretTerraformVariableError,
  targetNameError,
} from 'src/app/environment-sets/environment-set-rules';

export interface EnvironmentSetEntryDialogData {
  set: EnvironmentSet;
  /** The entry to edit; absent to add one. */
  entry?: EnvironmentSetEntry;
  secrets: EnvironmentSecrets | null;
  /** The connections, for connection entries. Empty when the user can't make them. */
  connections?: EnvironmentSetConnection[];
  /** Whether the user can make connection entries (ManageInfrastructure). */
  canUseConnections?: boolean;
  /**
   * Close with the entry's fields instead of saving them, for an edit of several sets.
   * The title is then this, and with an entry the kind and name can't change.
   */
  returnFields?: { title: string };
}

/** The fields the dialog returns with returnFields. */
export interface EnvironmentSetEntryFields {
  kind: EnvironmentSetEntryKind;
  targetName: string;
  valueSource: EnvironmentSetValueSource;
  secretName: string | null;
  value: string | null;
  connectionName: string | null;
  connectionField: ConnectionField | null;
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
  /** Kind and name identify an entry across sets, so a multi-edit can't change them. */
  readonly nameLocked = !!this.data.returnFields && this.isEdit;
  readonly title =
    this.data.returnFields?.title ??
    (this.isEdit
      ? `Edit Entry in ${this.data.set.name}`
      : `Add Entry to ${this.data.set.name}`);
  readonly patterns = this.data.secrets?.patterns ?? [];
  readonly availableSecrets = this.data.secrets?.available ?? [];
  readonly tooShortSecrets = this.data.secrets?.tooShort ?? [];
  readonly minimumMaskedLength = this.data.secrets?.minimumMaskedLength ?? 8;
  readonly connections = this.data.connections ?? [];
  /** A connection entry can be kept as it is, but only made or changed with ManageInfrastructure. */
  readonly connectionsOffered =
    !!this.data.canUseConnections ||
    this.data.entry?.valueSource === EnvironmentSetValueSource.Connection;

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
    connectionName: [this.data.entry?.connectionName ?? ''],
    connectionField: [
      (this.data.entry?.connectionField ?? null) as ConnectionField | null,
    ],
  });

  private readonly formValue = toSignal(
    // The raw value: a locked kind and name are disabled, and left out of value.
    this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );

  constructor() {
    const controls = this.form.controls;

    if (this.nameLocked) {
      controls.kind.disable();
      controls.targetName.disable();
    }

    controls.targetName.addValidators((c) => this.targetNameValidator(c));
    controls.secretName.addValidators((c) =>
      this.isSecret() ? this.secretNameValidator(c) : null,
    );
    controls.connectionName.addValidators((c) =>
      this.isConnection() && !c.value ? { required: true } : null,
    );
    controls.connectionField.addValidators((c) =>
      this.isConnection() && !c.value ? { required: true } : null,
    );
    this.form.addValidators(() => {
      const { kind, valueSource, connectionField } = this.form.getRawValue();
      return secretTerraformVariableError(kind, valueSource, connectionField)
        ? { secretTerraformVariable: true }
        : null;
    });

    // A change of kind or source changes what the other fields must be.
    controls.kind.valueChanges.subscribe(() =>
      controls.targetName.updateValueAndValidity(),
    );
    controls.valueSource.valueChanges.subscribe(() => {
      controls.secretName.updateValueAndValidity();
      controls.connectionName.updateValueAndValidity();
      controls.connectionField.updateValueAndValidity();
    });
    // A field another provider doesn't have is cleared.
    controls.connectionName.valueChanges.subscribe(() => {
      const field = controls.connectionField.value;
      if (field && !this.fields().some((x) => x.field === field)) {
        controls.connectionField.setValue(null);
      }
    });
  }

  isSecret(): boolean {
    return (
      this.form.controls.valueSource.value === EnvironmentSetValueSource.Secret
    );
  }

  isConnection(): boolean {
    return (
      this.form.controls.valueSource.value ===
      EnvironmentSetValueSource.Connection
    );
  }

  /** The chosen connection's fields, with whether each has a value. */
  fields(): EnvironmentSetConnectionField[] {
    const name = this.formValue().connectionName;
    return (
      this.connections.find(
        (x) => (x.name ?? '').toLowerCase() === (name ?? '').toLowerCase(),
      )?.fields ?? []
    );
  }

  selectedField(): EnvironmentSetConnectionField | null {
    const field = this.formValue().connectionField;
    return this.fields().find((x) => x.field === field) ?? null;
  }

  /** The connection an existing entry names, when it is no longer configured. */
  missingConnection(): boolean {
    const name = this.formValue().connectionName;
    return (
      this.isConnection() &&
      !!name &&
      !this.connections.some(
        (x) => (x.name ?? '').toLowerCase() === name.toLowerCase(),
      )
    );
  }

  /** Why the entry can't be saved as a Terraform variable, or null. */
  kindError(): string | null {
    const value = this.formValue();
    return secretTerraformVariableError(
      value.kind,
      value.valueSource,
      value.connectionField,
    );
  }

  /** A warning about the chosen secret's value, which a run would refuse. */
  warning(): string | null {
    const value = this.formValue();
    if (
      this.isSecret() &&
      this.tooShortSecrets.includes((value.secretName ?? '').trim())
    ) {
      return `This secret's value is shorter than ${this.minimumMaskedLength} characters, too short to mask in run output, so runs that use it fail.`;
    }
    return null;
  }

  secretValue(): boolean {
    const value = this.formValue();
    return isSecretSource(value.valueSource, value.connectionField);
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

    const {
      kind,
      targetName,
      valueSource,
      secretName,
      value,
      connectionName,
      connectionField,
    } = this.form.getRawValue();
    const connection = valueSource === EnvironmentSetValueSource.Connection;
    const command: EnvironmentSetEntryFields = {
      kind,
      targetName: targetName.trim(),
      valueSource,
      secretName:
        valueSource === EnvironmentSetValueSource.Secret
          ? secretName.trim()
          : null,
      value: valueSource === EnvironmentSetValueSource.Plain ? value : null,
      connectionName: connection ? connectionName : null,
      connectionField: connection ? connectionField : null,
    };

    if (this.data.returnFields) {
      this.dialogRef.close(command);
      return;
    }

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
