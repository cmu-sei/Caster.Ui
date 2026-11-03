// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';

export interface ProjectEnvironmentSetsData {
  projectId: string;
  projectName: string;
}

/**
 * The Environment Sets assigned to a project, read-only, as its members see them: target
 * names, plain values and whether each secret is available, never secret sources or values.
 * Kept current by the project's SignalR group.
 */
@Component({
  selector: 'cas-project-environment-sets',
  templateUrl: './project-environment-sets.component.html',
  styleUrls: ['./project-environment-sets.component.scss'],
  imports: [
    AsyncPipe,
    MatButton,
    MatIcon,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
  ],
})
export class ProjectEnvironmentSetsComponent implements OnInit {
  readonly data = inject<ProjectEnvironmentSetsData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProjectEnvironmentSetsComponent>);
  private environmentSetService = inject(EnvironmentSetService);

  readonly Kind = EnvironmentSetEntryKind;
  readonly Source = EnvironmentSetValueSource;
  readonly title = `Environment Sets: ${this.data.projectName}`;
  readonly sets$ = this.environmentSetService.projectSets$(this.data.projectId);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.environmentSetService.loadProjectSets(this.data.projectId).subscribe({
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
