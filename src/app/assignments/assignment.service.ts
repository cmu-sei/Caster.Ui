// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  AssignmentChange,
  AssignmentOperation,
  AssignmentsService,
  ProjectsService,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { AssignmentDiff, AssignmentItem } from './assignment.model';

/**
 * Adds and removes Environment Sets and inventory connections on projects, all in one request
 * that the API checks against the final state and saves together or not at all.
 */
@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private api = inject(AssignmentsService);
  private environmentSetService = inject(EnvironmentSetService);
  private projectsService = inject(ProjectsService);

  /** Every project the user can see, to assign to. */
  projectItems(): Observable<AssignmentItem[]> {
    return this.projectsService.getAllProjects(false).pipe(
      map((projects) =>
        (projects ?? []).map((x) => ({
          id: x.id,
          name: x.name ?? '',
          detail: x.description,
        })),
      ),
    );
  }

  /** Saves the changes, then re-reads the sets and project views they touch. */
  edit(changes: AssignmentChange[]): Observable<void> {
    if (changes.length === 0) {
      return of(undefined);
    }

    return this.api.editAssignments({ changes }).pipe(
      switchMap(() =>
        this.environmentSetService.assignmentsChanged(
          changes.map((x) => x.projectId),
          changes.map((x) => x.environmentSetId).filter((x) => !!x),
        ),
      ),
      map(() => undefined),
    );
  }
}

/** One project's set changes. */
export function projectSetChanges(
  projectId: string,
  diff: AssignmentDiff,
): AssignmentChange[] {
  return [
    ...diff.add.map((environmentSetId) => ({
      operation: AssignmentOperation.Add,
      projectId,
      environmentSetId,
    })),
    ...diff.remove.map((environmentSetId) => ({
      operation: AssignmentOperation.Remove,
      projectId,
      environmentSetId,
    })),
  ];
}

/** One project's connection changes, by connection name. */
export function projectConnectionChanges(
  projectId: string,
  diff: AssignmentDiff,
): AssignmentChange[] {
  return [
    ...diff.add.map((connectionName) => ({
      operation: AssignmentOperation.Add,
      projectId,
      connectionName,
    })),
    ...diff.remove.map((connectionName) => ({
      operation: AssignmentOperation.Remove,
      projectId,
      connectionName,
    })),
  ];
}

/** One set's changes across projects, by project id. */
export function setProjectChanges(
  environmentSetId: string,
  diff: AssignmentDiff,
): AssignmentChange[] {
  return [
    ...diff.add.map((projectId) => ({
      operation: AssignmentOperation.Add,
      projectId,
      environmentSetId,
    })),
    ...diff.remove.map((projectId) => ({
      operation: AssignmentOperation.Remove,
      projectId,
      environmentSetId,
    })),
  ];
}

/** One connection's changes across projects, by project id. */
export function connectionProjectChanges(
  connectionName: string,
  diff: AssignmentDiff,
): AssignmentChange[] {
  return [
    ...diff.add.map((projectId) => ({
      operation: AssignmentOperation.Add,
      projectId,
      connectionName,
    })),
    ...diff.remove.map((projectId) => ({
      operation: AssignmentOperation.Remove,
      projectId,
      connectionName,
    })),
  ];
}
