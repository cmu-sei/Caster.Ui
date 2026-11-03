// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { ProjectEnvironmentSetsViewComponent } from 'src/app/environment-sets/project-environment-sets-view/project-environment-sets-view.component';

export interface ProjectEnvironmentSetsData {
  projectId: string;
}

/** The project's Environment Sets, read-only, opened from the project sidebar. */
@Component({
  selector: 'cas-project-environment-sets',
  templateUrl: './project-environment-sets.component.html',
  imports: [
    MatButton,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    ProjectEnvironmentSetsViewComponent,
  ],
})
export class ProjectEnvironmentSetsComponent {
  readonly data = inject<ProjectEnvironmentSetsData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProjectEnvironmentSetsComponent>);

  close(): void {
    this.dialogRef.close();
  }
}
