// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';
import {
  CreateModuleScopeCommand,
  EditModuleScopeCommand,
  ModuleScope,
  ModuleScopesService,
  ProjectModuleAccess,
} from '../generated/caster-api';

/**
 * Module Scopes: the admin view of every scope (ViewModules or ManageModules) and each
 * project's own view of which Modules it may use (ViewProject).
 */
@Injectable({
  providedIn: 'root',
})
export class ModuleScopeService {
  private api = inject(ModuleScopesService);

  private scopesSubject = new BehaviorSubject<ModuleScope[]>([]);
  public scopes$ = this.scopesSubject.asObservable();

  private projectAccessSubject = new BehaviorSubject<
    Record<string, ProjectModuleAccess>
  >({});

  /** The scopes read so far. */
  currentScopes(): ModuleScope[] {
    return this.scopesSubject.getValue();
  }

  load(): Observable<ModuleScope[]> {
    return this.api
      .getModuleScopes()
      .pipe(tap((x) => this.scopesSubject.next(sortByName(x))));
  }

  create(command: CreateModuleScopeCommand) {
    return this.api.createModuleScope(command).pipe(tap((x) => this.upsert(x)));
  }

  edit(id: string, command: EditModuleScopeCommand) {
    return this.api
      .editModuleScope(id, command)
      .pipe(tap((x) => this.upsert(x)));
  }

  delete(id: string) {
    return this.api.deleteModuleScope(id).pipe(tap(() => this.remove(id)));
  }

  /** The member view of a project's access: null until loaded. */
  projectAccess$(projectId: string): Observable<ProjectModuleAccess | null> {
    return this.projectAccessSubject.pipe(
      map((x) => x[projectId] ?? null),
      distinctUntilChanged(),
    );
  }

  loadProjectAccess(projectId: string): Observable<ProjectModuleAccess> {
    return this.api.getProjectModuleScopes(projectId).pipe(
      tap((x) =>
        this.projectAccessSubject.next({
          ...this.projectAccessSubject.getValue(),
          [projectId]: x,
        }),
      ),
    );
  }

  /**
   * After assignments changed: re-reads the scopes already loaded here, whose projects
   * changed, and the access of the projects already loaded here.
   */
  assignmentsChanged(
    projectIds: string[],
    scopeIds: string[],
  ): Observable<unknown> {
    const loadedScopes = new Set(
      this.scopesSubject.getValue().map((x) => x.id),
    );
    const loadedProjects = this.projectAccessSubject.getValue();
    const reads: Observable<unknown>[] = [
      ...[...new Set(scopeIds)]
        .filter((id) => loadedScopes.has(id))
        .map((id) =>
          this.api.getModuleScope(id).pipe(tap((x) => this.upsert(x))),
        ),
      ...[...new Set(projectIds)]
        .filter((id) => id in loadedProjects)
        .map((id) => this.loadProjectAccess(id)),
    ];
    return reads.length ? forkJoin(reads) : of(null);
  }

  private upsert(scope: ModuleScope) {
    const scopes = this.scopesSubject
      .getValue()
      .filter((x) => x.id !== scope.id);
    this.scopesSubject.next(sortByName([...scopes, scope]));
  }

  private remove(id: string) {
    this.scopesSubject.next(
      this.scopesSubject.getValue().filter((x) => x.id !== id),
    );
  }
}

function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...(items ?? [])].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, {
      sensitivity: 'base',
    }),
  );
}
