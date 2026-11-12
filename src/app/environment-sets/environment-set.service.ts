// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import {
  BatchEditEnvironmentSetsCommand,
  CopyEnvironmentSetCommand,
  CreateEnvironmentSetCommand,
  CreateEnvironmentSetFromConnectionCommand,
  EnvironmentSetConnection,
  CreateEnvironmentSetEntryCommand,
  EditEnvironmentSetCommand,
  EditEnvironmentSetEntryCommand,
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetsService,
  ProjectEnvironmentSet,
} from '../generated/caster-api';

/**
 * Environment Sets: the admin view (every set, ViewEnvironmentSets) and the
 * member view of each project's sets (ViewProject). SignalR keeps both current.
 */
@Injectable({
  providedIn: 'root',
})
export class EnvironmentSetService {
  private api = inject(EnvironmentSetsService);

  private setsSubject = new BehaviorSubject<EnvironmentSet[]>([]);
  public sets$ = this.setsSubject.asObservable();

  private secretsSubject = new BehaviorSubject<EnvironmentSecrets | null>(null);
  public secrets$ = this.secretsSubject.asObservable();

  private connectionsSubject = new BehaviorSubject<EnvironmentSetConnection[]>(
    [],
  );
  /** The infrastructure connections' fields and presets, for connection entries. */
  public connections$ = this.connectionsSubject.asObservable();

  private projectSetsSubject = new BehaviorSubject<
    Record<string, ProjectEnvironmentSet[]>
  >({});

  load(): Observable<EnvironmentSet[]> {
    return this.api
      .getEnvironmentSets()
      .pipe(tap((x) => this.setsSubject.next(sortByName(x))));
  }

  loadSecrets(): Observable<EnvironmentSecrets> {
    return this.api
      .getEnvironmentSecrets()
      .pipe(tap((x) => this.secretsSubject.next(x)));
  }

  /** Needs ManageEnvironmentSets. */
  loadConnections(): Observable<EnvironmentSetConnection[]> {
    return this.api
      .getEnvironmentSetConnections()
      .pipe(tap((x) => this.connectionsSubject.next(x ?? [])));
  }

  copy(id: string, command: CopyEnvironmentSetCommand) {
    return this.api
      .copyEnvironmentSet(id, command)
      .pipe(tap((x) => this.upsert(x)));
  }

  /** Changes entries of several sets at once, checked and saved together. */
  batchEdit(command: BatchEditEnvironmentSetsCommand) {
    return this.api.batchEditEnvironmentSets(command).pipe(
      tap((sets) => {
        for (const set of sets ?? []) {
          this.upsert(set);
        }
      }),
    );
  }

  createFromConnection(command: CreateEnvironmentSetFromConnectionCommand) {
    return this.api
      .createEnvironmentSetFromConnection(command)
      .pipe(tap((x) => this.upsert(x)));
  }

  create(command: CreateEnvironmentSetCommand) {
    return this.api
      .createEnvironmentSet(command)
      .pipe(tap((x) => this.upsert(x)));
  }

  edit(id: string, command: EditEnvironmentSetCommand) {
    return this.api
      .editEnvironmentSet(id, command)
      .pipe(tap((x) => this.upsert(x)));
  }

  delete(id: string) {
    return this.api.deleteEnvironmentSet(id).pipe(tap(() => this.remove(id)));
  }

  createEntry(setId: string, command: CreateEnvironmentSetEntryCommand) {
    return this.api
      .createEnvironmentSetEntry(setId, command)
      .pipe(tap((x) => this.entriesChanged(x)));
  }

  editEntry(
    setId: string,
    entryId: string,
    command: EditEnvironmentSetEntryCommand,
  ) {
    return this.api
      .editEnvironmentSetEntry(setId, entryId, command)
      .pipe(tap((x) => this.entriesChanged(x)));
  }

  deleteEntry(setId: string, entryId: string) {
    return this.api
      .deleteEnvironmentSetEntry(setId, entryId)
      .pipe(tap((x) => this.entriesChanged(x)));
  }

  unassign(projectId: string, setId: string) {
    return this.api.unassignEnvironmentSet(projectId, setId).pipe(
      tap(() =>
        this.projectSetsUpdated(
          projectId,
          (this.projectSetsSubject.getValue()[projectId] ?? []).filter(
            (x) => x.environmentSetId !== setId,
          ),
        ),
      ),
      switchMap(() => this.refresh(setId)),
    );
  }

  /**
   * After assignments changed elsewhere: re-reads the sets already loaded here, whose projects
   * changed, and the member views of the projects already loaded here.
   */
  assignmentsChanged(
    projectIds: string[],
    setIds: string[],
  ): Observable<unknown> {
    const loadedSets = new Set(this.setsSubject.getValue().map((x) => x.id));
    const loadedProjects = this.projectSetsSubject.getValue();
    const reads: Observable<unknown>[] = [
      ...[...new Set(setIds)]
        .filter((id) => loadedSets.has(id))
        .map((id) => this.refresh(id)),
      ...[...new Set(projectIds)]
        .filter((id) => id in loadedProjects)
        .map((id) => this.loadProjectSets(id)),
    ];
    return reads.length ? forkJoin(reads) : of(null);
  }

  /** Re-reads one set: its projects change with an assignment. */
  private refresh(setId: string): Observable<EnvironmentSet> {
    return this.api.getEnvironmentSet(setId).pipe(tap((x) => this.upsert(x)));
  }

  /** The member view of a project's sets, kept current by SignalR once loaded. */
  projectSets$(projectId: string): Observable<ProjectEnvironmentSet[] | null> {
    return this.projectSetsSubject.pipe(
      map((x) => x[projectId] ?? null),
      distinctUntilChanged(),
    );
  }

  loadProjectSets(projectId: string): Observable<ProjectEnvironmentSet[]> {
    return this.api
      .getProjectEnvironmentSets(projectId)
      .pipe(tap((x) => this.projectSetsUpdated(projectId, x)));
  }

  /** From SignalR (EnvironmentSetCreated/Updated) and from this service's own writes. */
  upsert(set: EnvironmentSet) {
    const sets = this.setsSubject.getValue().filter((x) => x.id !== set.id);
    this.setsSubject.next(sortByName([...sets, set]));
  }

  /** From SignalR (EnvironmentSetDeleted). */
  remove(id: string) {
    this.setsSubject.next(
      this.setsSubject.getValue().filter((x) => x.id !== id),
    );
  }

  /** From SignalR (ProjectEnvironmentSetsUpdated). */
  projectSetsUpdated(projectId: string, sets: ProjectEnvironmentSet[]) {
    this.projectSetsSubject.next({
      ...this.projectSetsSubject.getValue(),
      [projectId]: sortByName(sets ?? []),
    });
  }

  private entriesChanged(set: EnvironmentSet) {
    this.upsert(set);

    // A source added or removed changes what is missing.
    if (this.secretsSubject.getValue()) {
      this.loadSecrets().subscribe();
    }
  }
}

function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...(items ?? [])].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, {
      sensitivity: 'base',
    }),
  );
}
