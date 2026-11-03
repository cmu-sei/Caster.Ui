// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetEntry,
  EnvironmentSetEntryKind,
  EnvironmentSetProject,
  EnvironmentSetValueSource,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { secretTerraformVariableWarning } from 'src/app/environment-sets/environment-set-rules';
import {
  deliveredAs,
  kindLabel,
  variableLabel,
} from 'src/app/environment-sets/environment-set-snippets';
import {
  EnvironmentSetEntryDialogComponent,
  EnvironmentSetEntryDialogData,
} from '../environment-set-entry-dialog/environment-set-entry-dialog.component';
import {
  AssignProjectDialogComponent,
  AssignProjectDialogData,
} from '../assign-project-dialog/assign-project-dialog.component';

/** One set's entries and the projects it is assigned to. */
@Component({
  selector: 'cas-environment-set-detail',
  templateUrl: './environment-set-detail.component.html',
  styleUrls: ['./environment-set-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIcon, MatButton, MatIconButton, MatTooltip],
})
export class EnvironmentSetDetailComponent {
  private dialog = inject(MatDialog);
  private confirmService = inject(CrucibleDialogService);
  private environmentSetService = inject(EnvironmentSetService);

  readonly set = input.required<EnvironmentSet>();
  readonly canEdit = input(false);
  readonly secrets = input<EnvironmentSecrets | null>(null);

  readonly Kind = EnvironmentSetEntryKind;
  readonly Source = EnvironmentSetValueSource;
  readonly variableLabel = variableLabel;
  readonly deliveredAs = deliveredAs;
  readonly kindLabel = kindLabel;

  warning(entry: EnvironmentSetEntry): string | null {
    return secretTerraformVariableWarning(
      entry.kind,
      entry.valueSource,
      this.secrets()?.runMode,
    );
  }

  addEntry(): void {
    this.openEntryDialog({ set: this.set(), secrets: this.secrets() });
  }

  editEntry(entry: EnvironmentSetEntry): void {
    this.openEntryDialog({ set: this.set(), entry, secrets: this.secrets() });
  }

  deleteEntry(entry: EnvironmentSetEntry): void {
    this.confirmService
      .confirm({
        title: 'Delete Entry',
        message: `Delete ${variableLabel(entry)} from ${this.set().name}? Runs in its projects will no longer get it.`,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.environmentSetService
            .deleteEntry(this.set().id, entry.id)
            .subscribe();
        }
      });
  }

  assign(): void {
    this.dialog.open<AssignProjectDialogComponent, AssignProjectDialogData>(
      AssignProjectDialogComponent,
      {
        data: { set: this.set() },
        width: '480px',
        maxWidth: '90vw',
        disableClose: true,
      },
    );
  }

  unassign(project: EnvironmentSetProject): void {
    this.confirmService
      .confirm({
        title: 'Remove from Project',
        message: `Remove ${this.set().name} from ${project.name}? Its next runs will not get these variables.`,
        confirmText: 'Remove',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.environmentSetService
            .unassign(project.projectId, this.set().id)
            .subscribe();
        }
      });
  }

  private openEntryDialog(data: EnvironmentSetEntryDialogData): void {
    this.dialog.open<
      EnvironmentSetEntryDialogComponent,
      EnvironmentSetEntryDialogData
    >(EnvironmentSetEntryDialogComponent, {
      data,
      width: '560px',
      maxWidth: '90vw',
      disableClose: true,
    });
  }
}
