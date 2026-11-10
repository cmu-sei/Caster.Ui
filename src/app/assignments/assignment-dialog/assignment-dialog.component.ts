// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';
import { AssignmentChecklistComponent } from '../assignment-checklist/assignment-checklist.component';
import {
  AssignmentDiff,
  AssignmentItem,
  assignmentDiff,
  saveLabel,
} from '../assignment.model';

/** One list in the dialog: a tab of its own when there are several. */
export interface AssignmentSection {
  label: string;
  items: AssignmentItem[];
  assigned: string[];
  searchLabel?: string;
  emptyText?: string;
}

export interface AssignmentDialogData {
  title: string;
  description?: string;
  sections: AssignmentSection[];
  /** Saves every section's changes in one request; the dialog shows its error and stays open. */
  save: (changes: AssignmentDiff[]) => Observable<unknown>;
}

/** Assigns one thing (a set, a connection) to many, from the thing's own page. */
@Component({
  selector: 'cas-assignment-dialog',
  templateUrl: './assignment-dialog.component.html',
  styleUrls: ['./assignment-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    MatTabGroup,
    MatTab,
    AssignmentChecklistComponent,
    NgTemplateOutlet,
  ],
})
export class AssignmentDialogComponent {
  readonly data = inject<AssignmentDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<AssignmentDialogComponent>);

  readonly selections = this.data.sections.map((x) => signal([...x.assigned]));
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private readonly diffs = computed(() =>
    this.data.sections.map((section, i) =>
      assignmentDiff(section.assigned, this.selections[i]()),
    ),
  );

  readonly changeCount = computed(() =>
    this.diffs().reduce((n, x) => n + x.add.length + x.remove.length, 0),
  );

  readonly submitLabel = computed(() => saveLabel(this.changeCount()));

  save(): void {
    if (this.saving() || this.changeCount() === 0) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.data.save(this.diffs()).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err));
      },
    });
  }
}
