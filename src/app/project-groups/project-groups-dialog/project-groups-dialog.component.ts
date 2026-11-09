// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import {
  CrucibleDialogActionsDirective,
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { ProjectGroupsListComponent } from '../project-groups-list/project-groups-list.component';

/** The project groups a user belongs to, for group managers who aren't administrators. */
@Component({
  selector: 'cas-project-groups-dialog',
  template: `
    <crucible-dialog dialogTitle="Project Groups" [hideDefaultActions]="true">
      <div crucibleDialogContent>
        <cas-project-groups-list />
      </div>
      <div crucibleDialogActions>
        <button
          matButton="filled"
          type="button"
          cdkFocusInitial
          (click)="dialogRef.close()"
        >
          Close
        </button>
      </div>
    </crucible-dialog>
  `,
  imports: [
    MatButton,
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    CrucibleDialogActionsDirective,
    ProjectGroupsListComponent,
  ],
})
export class ProjectGroupsDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ProjectGroupsDialogComponent>);
}
