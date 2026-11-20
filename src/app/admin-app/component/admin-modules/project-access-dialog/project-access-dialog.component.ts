// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
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
  UNASSIGNED_ACCESS,
  allowsSource,
  coversOtherPaths,
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
  /** Whether it also allows paths other than this source's: other sources or folders. */
  coversOthers: boolean;
}

/** What the dialog says first: who a project added here may use, and what adding it does. */
export const ACCESS_NOTE =
  'Projects and groups you add can use this source and every shared source. ' +
  UNASSIGNED_ACCESS +
  ' Adding a project here limits it to the sources assigned to it.';

/**
 * Who may use one module source. Behind the scenes the source has a scope of its own (the one
 * whose only path is the source, named as the source), made on the first save. The scope is
 * saved first when it is new, then the projects and groups added or removed in one request; if
 * the assignments fail the scope is kept and the dialog stays open on it, so a retry edits the
 * same scope. Once the assignments are saved they are the baseline for any further save, so a
 * failure to read the lists again afterwards is reported on its own and never undoes or repeats
 * them. A scope that allows the source, by its name or through a parent path, is only listed.
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
  private snackBar = inject(MatSnackBar);
  private fb = inject(NonNullableFormBuilder);
  readonly note = ACCESS_NOTE;

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
      (x) => x.id !== this.current()?.id && allowsSource(x, this.data.source),
    )
    .map((x) => ({
      name: x.name,
      projects: (x.projects ?? []).map((p) => p.name),
      groups: (x.projectGroups ?? []).map((g) => g.name),
      coversOthers: coversOtherPaths(x, this.data.source),
    }));

  /**
   * What the scope is assigned to: as it was when the dialog opened, then as last saved, to work
   * out the changes of the next save.
   */
  readonly initialProjects = signal<string[]>(
    (this.current()?.projects ?? []).map((x) => x.projectId),
  );
  readonly initialGroups = signal<string[]>(
    (this.current()?.projectGroups ?? []).map((x) => x.projectGroupId),
  );
  readonly selectedProjects = signal<string[]>([...this.initialProjects()]);
  readonly selectedGroups = signal<string[]>([...this.initialGroups()]);

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

  /** The scope as the saved selection leaves it, with names from the lists or the scope. */
  private savedScope(
    scope: ModuleScope,
    projectIds: string[],
    groupIds: string[],
  ): ModuleScope {
    const named = (
      ids: string[],
      items: AssignmentItem[] | null,
      known: { id: string; name?: string | null }[],
    ) =>
      ids.map((id) => ({
        id,
        name:
          items?.find((x) => x.id === id)?.name ??
          known.find((x) => x.id === id)?.name ??
          '',
      }));
    return {
      ...scope,
      projects: named(
        projectIds,
        this.projects(),
        (scope.projects ?? []).map((x) => ({ id: x.projectId, name: x.name })),
      ).map((x) => ({ projectId: x.id, name: x.name })),
      projectGroups: named(
        groupIds,
        this.groups(),
        (scope.projectGroups ?? []).map((x) => ({
          id: x.projectGroupId,
          name: x.name,
        })),
      ).map((x) => ({ projectGroupId: x.id, name: x.name })),
    };
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

    let refreshFailed = false;

    saved$
      .pipe(
        switchMap((scope) => {
          // From here a retry changes this scope, not makes another.
          this.current.set(scope);
          // What this request commits: the selection can change while it is in flight.
          const projects = [...this.selectedProjects()];
          const groups = [...this.selectedGroups()];
          const changes = [
            ...scopeProjectChanges(
              scope.id,
              assignmentDiff(this.initialProjects(), projects),
            ),
            ...scopeGroupChanges(
              scope.id,
              assignmentDiff(this.initialGroups(), groups),
            ),
          ];
          return this.assignmentService.save(changes).pipe(
            // Saved: this is the baseline now, whatever the re-read below does.
            tap(() => {
              this.initialProjects.set(projects);
              this.initialGroups.set(groups);
            }),
            switchMap(() =>
              this.assignmentService.refresh(changes).pipe(
                catchError(() => {
                  refreshFailed = true;
                  // The lists could not be read again: keep what was saved in the cache.
                  this.moduleScopeService.replace(
                    this.savedScope(scope, projects, groups),
                  );
                  return of(undefined);
                }),
              ),
            ),
            map(() => scope),
          );
        }),
      )
      .subscribe({
        next: (scope) => {
          if (refreshFailed) {
            this.snackBar.open(
              'The change was saved, but the list could not be refreshed',
              'Dismiss',
              {
                duration: 5000,
                verticalPosition: 'top',
                horizontalPosition: 'center',
              },
            );
          }
          this.dialogRef.close(scope);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(
            this.current()
              ? `The access was prepared, but assigning it failed: ${apiErrorMessage(err)}`
              : apiErrorMessage(err),
          );
        },
      });
  }
}
