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
import { forkJoin } from 'rxjs';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetConnection,
  EnvironmentSetEntry,
  EnvironmentSetEntryKind,
  EnvironmentSetProject,
  EnvironmentSetValueSource,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
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
  AssignmentService,
  setGroupChanges,
  setProjectChanges,
} from 'src/app/assignments/assignment.service';
import {
  AssignmentDialogComponent,
  AssignmentDialogData,
} from 'src/app/assignments/assignment-dialog/assignment-dialog.component';
import { connectionEntryLockedText } from 'src/app/environment-sets/environment-set-rules';

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
  private assignmentService = inject(AssignmentService);

  readonly set = input.required<EnvironmentSet>();
  readonly canEdit = input(false);
  readonly secrets = input<EnvironmentSecrets | null>(null);
  readonly connections = input<EnvironmentSetConnection[]>([]);
  /** Whether the user can make connection entries (ManageInfrastructure). */
  readonly canUseConnections = input(false);

  readonly Kind = EnvironmentSetEntryKind;
  readonly Source = EnvironmentSetValueSource;
  readonly lockedText = connectionEntryLockedText;
  readonly variableLabel = variableLabel;
  readonly deliveredAs = deliveredAs;
  readonly kindLabel = kindLabel;

  addEntry(): void {
    this.openEntryDialog({ set: this.set(), ...this.dialogContext() });
  }

  editEntry(entry: EnvironmentSetEntry): void {
    this.openEntryDialog({ set: this.set(), entry, ...this.dialogContext() });
  }

  /** A connection entry can only be changed with ManageInfrastructure. */
  canEditEntry(entry: EnvironmentSetEntry): boolean {
    return (
      this.canEdit() &&
      (entry.valueSource !== EnvironmentSetValueSource.Connection ||
        this.canUseConnections())
    );
  }

  private dialogContext() {
    return {
      secrets: this.secrets(),
      connections: this.connections(),
      canUseConnections: this.canUseConnections(),
    };
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

  /** Adds and removes the set's projects together, checked against the final state. */
  assign(): void {
    const set = this.set();
    forkJoin([
      this.assignmentService.projectItems(),
      this.assignmentService.groupItems(),
    ]).subscribe(([projects, groups]) =>
      this.dialog.open<AssignmentDialogComponent, AssignmentDialogData>(
        AssignmentDialogComponent,
        {
          data: {
            title: `Assign ${set.name}`,
            description:
              "Every workspace in a project gets this set's variables on its next run. A project group's set reaches every project in it.",
            sections: [
              {
                label: 'Projects',
                items: projects,
                assigned: (set.projects ?? []).map((x) => x.projectId),
                searchLabel: 'Search projects',
                emptyText: 'There are no projects.',
              },
              {
                label: 'Project Groups',
                items: groups,
                assigned: (set.projectGroups ?? []).map(
                  (x) => x.projectGroupId,
                ),
                searchLabel: 'Search project groups',
                emptyText: 'There are no project groups.',
              },
            ],
            save: ([toProjects, toGroups]) =>
              this.assignmentService.edit([
                ...setProjectChanges(set.id, toProjects),
                ...setGroupChanges(set.id, toGroups),
              ]),
          },
          width: '640px',
          maxWidth: '90vw',
          disableClose: true,
        },
      ),
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
