// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatIcon } from '@angular/material/icon';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { startWith } from 'rxjs/operators';
import {
  EnvironmentSetConnection,
  EnvironmentSetConnectionPreset,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';

export interface CreateFromConnectionDialogData {
  connections: EnvironmentSetConnection[];
}

/** Makes a set holding a provider preset's entries for one connection. */
@Component({
  selector: 'cas-create-from-connection-dialog',
  templateUrl: './create-from-connection-dialog.component.html',
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
  ],
})
export class CreateFromConnectionDialogComponent {
  readonly data = inject<CreateFromConnectionDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<CreateFromConnectionDialogComponent>);
  private environmentSetService = inject(EnvironmentSetService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    connectionName: [this.data.connections[0]?.name ?? '', Validators.required],
    preset: ['', Validators.required],
    name: [''],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  constructor() {
    this.pickFirstPreset(this.form.controls.connectionName.value);
    // The control's own value: the form's value, and so connection(), hasn't caught up yet.
    this.form.controls.connectionName.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((name) => this.pickFirstPreset(name));
  }

  connection(): EnvironmentSetConnection | null {
    return this.find(this.value().connectionName);
  }

  preset(): EnvironmentSetConnectionPreset | null {
    return (
      this.connection()?.presets?.find((x) => x.id === this.value().preset) ??
      null
    );
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    const { connectionName, preset, name } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    this.environmentSetService
      .createFromConnection({
        connectionName,
        preset,
        name: name.trim() || null,
      })
      .subscribe({
        next: (set) => this.dialogRef.close(set),
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(err));
        },
      });
  }

  private find(name: string): EnvironmentSetConnection | null {
    return this.data.connections.find((x) => x.name === name) ?? null;
  }

  private pickFirstPreset(connectionName: string): void {
    const presets = this.find(connectionName)?.presets ?? [];
    const current = this.form.controls.preset.value;

    if (!presets.some((x) => x.id === current)) {
      this.form.controls.preset.setValue(presets[0]?.id ?? '');
    }
  }
}
