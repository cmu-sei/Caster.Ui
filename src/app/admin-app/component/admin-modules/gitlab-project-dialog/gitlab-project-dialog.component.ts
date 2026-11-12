// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';

/**
 * Asks for the GitLab project ID of one Module in the legacy GitLab source,
 * and closes with it. A GitLab source is synced one project at a time by ID,
 * not by its source name.
 */
@Component({
  selector: 'cas-gitlab-project-dialog',
  templateUrl: './gitlab-project-dialog.component.html',
  styleUrls: ['./gitlab-project-dialog.component.css'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
  ],
})
export class GitlabProjectDialogComponent {
  private dialogRef = inject(
    MatDialogRef<GitlabProjectDialogComponent, string>,
  );
  private formBuilder = inject(NonNullableFormBuilder);

  public form = this.formBuilder.group({
    projectId: ['', [Validators.required, Validators.pattern(/^\s*\d+\s*$/)]],
  });

  get projectId() {
    return this.form.controls.projectId;
  }

  onSubmit(): void {
    this.dialogRef.close(this.projectId.value.trim());
  }
}
