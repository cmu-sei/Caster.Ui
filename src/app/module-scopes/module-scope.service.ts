// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CreateModuleScopeCommand,
  ModuleScope,
  ModuleScopesService,
} from '../generated/caster-api';

/** Module Scopes: the admin view of every scope (ViewModules or ManageModules). */
@Injectable({
  providedIn: 'root',
})
export class ModuleScopeService {
  private api = inject(ModuleScopesService);

  private scopesSubject = new BehaviorSubject<ModuleScope[]>([]);
  public scopes$ = this.scopesSubject.asObservable();

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

  /** After assignments changed: re-reads the scopes already loaded here that changed. */
  assignmentsChanged(scopeIds: string[]): Observable<unknown> {
    const loadedScopes = new Set(
      this.scopesSubject.getValue().map((x) => x.id),
    );
    const reads = [...new Set(scopeIds)]
      .filter((id) => loadedScopes.has(id))
      .map((id) =>
        this.api.getModuleScope(id).pipe(tap((x) => this.upsert(x))),
      );
    return reads.length ? forkJoin(reads) : of(null);
  }

  /** Replaces a scope in the cache with a known state, such as one a saved change produced. */
  replace(scope: ModuleScope) {
    this.upsert(scope);
  }

  private upsert(scope: ModuleScope) {
    const scopes = this.scopesSubject
      .getValue()
      .filter((x) => x.id !== scope.id);
    this.scopesSubject.next(sortByName([...scopes, scope]));
  }
}

function sortByName<T extends { name?: string | null }>(items: T[]): T[] {
  return [...(items ?? [])].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', undefined, {
      sensitivity: 'base',
    }),
  );
}
