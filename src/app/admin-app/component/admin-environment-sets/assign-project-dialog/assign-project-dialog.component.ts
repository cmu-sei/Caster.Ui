// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, inject, signal } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { MatFormField, MatLabel, MatHint } from '@angular/material/form-field';
import { MatSelect, MatOption } from '@angular/material/select';
import {
  EnvironmentSet,
  Project,
  ProjectsService,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';

export interface AssignProjectDialogData {
  set: EnvironmentSet;
}

/** Assigns a set to one more project. Saves itself, so a conflict is shown here. */
@Component({
  selector: 'cas-assign-project-dialog',
  templateUrl: './assign-project-dialog.component.html',
  styleUrls: ['./assign-project-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatHint,
    MatSelect,
    MatOption,
  ],
})
export class AssignProjectDialogComponent implements OnInit {
  readonly data = inject<AssignProjectDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<AssignProjectDialogComponent>);
  private formBuilder = inject(NonNullableFormBuilder);
  private projectsService = inject(ProjectsService);
  private environmentSetService = inject(EnvironmentSetService);

  readonly title = `Assign ${this.data.set.name} to a Project`;
  readonly projects = signal<Project[] | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.formBuilder.group({
    projectId: ['', Validators.required],
  });

  ngOnInit(): void {
    const assigned = new Set(
      (this.data.set.projects ?? []).map((x) => x.projectId),
    );

    this.projectsService.getAllProjects(false).subscribe({
      next: (projects) =>
        this.projects.set(
          projects
            .filter((x) => !assigned.has(x.id))
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
        ),
      error: (err) => {
        this.projects.set([]);
        this.error.set(apiErrorMessage(err));
      },
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.environmentSetService
      .assign(this.form.getRawValue().projectId, this.data.set.id)
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(err));
        },
      });
  }
}
