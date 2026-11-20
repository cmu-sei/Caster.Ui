// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import {
  AssignmentsService,
  ModuleScope,
  ModuleScopesService,
  ProjectModuleAccess,
} from '../generated/caster-api';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { ModuleScopeService } from '../module-scopes/module-scope.service';
import {
  AssignmentService,
  projectScopeChanges,
  scopeGroupChanges,
  scopeProjectChanges,
} from './assignment.service';

const diff = { add: ['a'], remove: ['b'] };

describe('Module Scope assignment changes', () => {
  /**
   * Verifies: one project's scope diff becomes Add and Remove changes naming the project and the scope, nothing else.
   * Interacts with: projectScopeChanges (pure).
   * Data: add a, remove b on project p1.
   */
  it("builds a project's changes", () => {
    expect(projectScopeChanges('p1', diff)).toEqual([
      { operation: 'Add', projectId: 'p1', moduleScopeId: 'a' },
      { operation: 'Remove', projectId: 'p1', moduleScopeId: 'b' },
    ]);
  });

  /**
   * Verifies: one scope's project diff and group diff each become changes naming the scope, and a project or a group.
   * Interacts with: scopeProjectChanges and scopeGroupChanges (pure).
   * Data: scope s1; add a, remove b.
   */
  it("builds a scope's changes across projects and across groups", () => {
    expect(scopeProjectChanges('s1', diff)).toEqual([
      { operation: 'Add', projectId: 'a', moduleScopeId: 's1' },
      { operation: 'Remove', projectId: 'b', moduleScopeId: 's1' },
    ]);
    expect(scopeGroupChanges('s1', diff)).toEqual([
      { operation: 'Add', projectGroupId: 'a', moduleScopeId: 's1' },
      { operation: 'Remove', projectGroupId: 'b', moduleScopeId: 's1' },
    ]);
  });
});

describe('AssignmentService', () => {
  /**
   * Verifies: after saving scope changes, the scopes and projects already loaded are read again, so the pages show the new assignments.
   * Interacts with: AssignmentsService.editAssignments, ModuleScopesService.getModuleScope and getProjectModuleScopes (stubs), the real ModuleScopeService.
   * Data: scope s1 and project p1 loaded; a change adds s1 to p1.
   */
  it('re-reads the loaded scopes and projects after an edit', async () => {
    const scopesApi = {
      getModuleScopes: vi.fn(() =>
        of<ModuleScope[]>([{ id: 's1', name: 'a' }]),
      ),
      getModuleScope: vi.fn((id: string) => of<ModuleScope>({ id, name: 'a' })),
      getProjectModuleScopes: vi.fn((projectId: string) =>
        of<ProjectModuleAccess>({ projectId, restricted: true }),
      ),
    };
    const assignmentsApi = { editAssignments: vi.fn(() => of<unknown>(null)) };
    TestBed.configureTestingModule({
      providers: getDefaultProviders([
        { provide: ModuleScopesService, useValue: scopesApi },
        { provide: AssignmentsService, useValue: assignmentsApi },
      ]),
    });
    const scopes = TestBed.inject(ModuleScopeService);
    await firstValueFrom(scopes.load());
    await firstValueFrom(scopes.loadProjectAccess('p1'));
    scopesApi.getProjectModuleScopes.mockClear();

    await firstValueFrom(
      TestBed.inject(AssignmentService).edit(
        projectScopeChanges('p1', { add: ['s1'], remove: [] }),
      ),
    );

    expect(assignmentsApi.editAssignments).toHaveBeenCalledWith({
      changes: [{ operation: 'Add', projectId: 'p1', moduleScopeId: 's1' }],
    });
    expect(scopesApi.getModuleScope).toHaveBeenCalledWith('s1');
    expect(scopesApi.getProjectModuleScopes).toHaveBeenCalledWith('p1');
  });
});
