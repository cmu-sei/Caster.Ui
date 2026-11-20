// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AssignmentChecklistComponent } from 'src/app/assignments/assignment-checklist/assignment-checklist.component';
import {
  AssignmentItem,
  assignmentDiff,
} from 'src/app/assignments/assignment.model';
import {
  AssignmentService,
  scopeGroupChanges,
  scopeProjectChanges,
} from 'src/app/assignments/assignment.service';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';
import { ModuleScope } from 'src/app/generated/caster-api';
import { ModuleScopeService } from 'src/app/module-scopes/module-scope.service';
import {
  MANAGED_DESCRIPTION,
  managedScopeOf,
} from 'src/app/module-scopes/module-scope-rules';

export interface ProjectAccessDialogData {
  /** The source whose access is changed. */
  source: string;
  /** Every Module Scope, to find the source's own and those that also allow it. */
  scopes: ModuleScope[];
}

/** A scope that allows the source together with other paths: shown, not changed. */
export interface AlsoAllowed {
  name: string;
  projects: string[];
  groups: string[];
}

/**
 * Who may use one module source. Behind the scenes the source has a scope of its own (the one
 * whose only path is the source, named as the source), made on the first save. The scope is
 * saved first when it is new, then the projects and groups added or removed in one request; if
 * the assignments fail the scope is kept and the dialog stays open on it, so a retry edits the
 * same scope. A scope that allows the source together with other paths is only listed.
 */
@Component({
  selector: 'cas-project-access-dialog',
  templateUrl: './project-access-dialog.component.html',
  styleUrls: ['./project-access-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    ReactiveFormsModule,
    MatTab,
    MatTabGroup,
    AssignmentChecklistComponent,
  ],
})
export class ProjectAccessDialogComponent implements OnInit {
  readonly data = inject<ProjectAccessDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProjectAccessDialogComponent>);
  private moduleScopeService = inject(ModuleScopeService);
  private assignmentService = inject(AssignmentService);
  private fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({});
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** The source's own scope; null until it has one. Set after a first save too. */
  readonly current = signal<ModuleScope | null>(
    managedScopeOf(this.data.source, this.data.scopes ?? []),
  );

  /** Other scopes that allow the source, with what each is assigned to. */
  readonly alsoAllowed: AlsoAllowed[] = (this.data.scopes ?? [])
    .filter(
      (x) =>
        x.id !== this.current()?.id &&
        (x.paths ?? []).some(
          (p) => p.replace(/^\/+|\/+$/g, '') === this.data.source,
        ),
    )
    .map((x) => ({
      name: x.name,
      projects: (x.projects ?? []).map((p) => p.name),
      groups: (x.projectGroups ?? []).map((g) => g.name),
    }));

  /** What the scope was assigned to when the dialog opened, to work out the changes. */
  readonly initialProjects = (this.current()?.projects ?? []).map(
    (x) => x.projectId,
  );
  readonly initialGroups = (this.current()?.projectGroups ?? []).map(
    (x) => x.projectGroupId,
  );
  readonly selectedProjects = signal<string[]>([...this.initialProjects]);
  readonly selectedGroups = signal<string[]>([...this.initialGroups]);

  /** Every project and group the user can see; null while loading, empty when they can't be loaded. */
  readonly projects = signal<AssignmentItem[] | null>(null);
  readonly groups = signal<AssignmentItem[] | null>(null);
  readonly assignmentsUnavailable = signal(false);

  /** Whether the source is allowed to nobody yet. */
  readonly assignedNone = computed(
    () => !this.selectedProjects().length && !this.selectedGroups().length,
  );

  ngOnInit(): void {
    forkJoin([
      this.assignmentService.projectItems(),
      this.assignmentService.groupItems(),
    ])
      .pipe(
        catchError(() => {
          this.assignmentsUnavailable.set(true);
          return of<[AssignmentItem[], AssignmentItem[]]>([[], []]);
        }),
      )
      .subscribe(([projects, groups]) => {
        this.projects.set(projects);
        this.groups.set(groups);
      });
  }

  save(): void {
    if (this.saving()) {
      return;
    }

    const existing = this.current();
    if (!existing && this.assignedNone()) {
      // Nothing to assign and no scope to change.
      this.dialogRef.close();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const saved$ = existing
      ? of(existing)
      : this.moduleScopeService.create({
          name: this.data.source,
          description: MANAGED_DESCRIPTION,
          paths: [this.data.source],
        });

    saved$
      .pipe(
        switchMap((scope) => {
          // From here a retry changes this scope, not makes another.
          this.current.set(scope);
          const changes = [
            ...scopeProjectChanges(
              scope.id,
              assignmentDiff(this.initialProjects, this.selectedProjects()),
            ),
            ...scopeGroupChanges(
              scope.id,
              assignmentDiff(this.initialGroups, this.selectedGroups()),
            ),
          ];
          return this.assignmentService.edit(changes).pipe(
            catchError((err) => {
              throw new ScopeSavedError(apiErrorMessage(err));
            }),
            switchMap(() => of(scope)),
          );
        }),
      )
      .subscribe({
        next: (scope) => this.dialogRef.close(scope),
        error: (err) => {
          this.saving.set(false);
          this.error.set(
            err instanceof ScopeSavedError
              ? `The access was prepared, but assigning it failed: ${err.message}`
              : apiErrorMessage(err),
          );
        },
      });
  }
}

/** The scope was saved and its assignments were not. */
class ScopeSavedError extends Error {}
