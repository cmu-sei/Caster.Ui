// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import {
  ModuleScope,
  ModuleScopesService,
  ProjectModuleAccess,
} from '../generated/caster-api';
import { ApiStub } from '../test-utils/api-stub';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { ModuleScopeService } from './module-scope.service';

function setup(api: ApiStub<ModuleScopesService>) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: ModuleScopesService, useValue: api },
    ]),
  });
  return TestBed.inject(ModuleScopeService);
}

const names = (scopes: ModuleScope[]) => scopes.map((x) => x.name);

describe('ModuleScopeService', () => {
  /**
   * Verifies: load() publishes the scopes sorted by name, ignoring case.
   * Interacts with: ModuleScopesService.getModuleScopes (stub).
   * Data: 'sei', 'CMU', 'cyber'.
   */
  it('load() publishes the scopes sorted by name', async () => {
    const service = setup({
      getModuleScopes: vi.fn(() =>
        of<ModuleScope[]>([
          { id: '1', name: 'sei' },
          { id: '2', name: 'CMU' },
          { id: '3', name: 'cyber' },
        ]),
      ),
    });

    await firstValueFrom(service.load());

    expect(names(await firstValueFrom(service.scopes$))).toEqual([
      'CMU',
      'cyber',
      'sei',
    ]);
    expect(names(service.currentScopes())).toEqual(['CMU', 'cyber', 'sei']);
  });

  /**
   * Verifies: create, edit and delete keep the published list current without a reload.
   * Interacts with: ModuleScopesService create/edit/delete (stubs).
   * Data: one scope created, renamed, then deleted.
   */
  it('keeps the list current after create, edit and delete', async () => {
    const service = setup({
      createModuleScope: vi.fn(() =>
        of<ModuleScope>({ id: '1', name: 'cmu', paths: ['cmu'] }),
      ),
      editModuleScope: vi.fn(() =>
        of<ModuleScope>({ id: '1', name: 'cmu renamed', paths: ['cmu'] }),
      ),
      deleteModuleScope: vi.fn(() => of<unknown>(null)),
    });

    await firstValueFrom(service.create({ name: 'cmu', paths: ['cmu'] }));
    expect(names(await firstValueFrom(service.scopes$))).toEqual(['cmu']);

    await firstValueFrom(
      service.edit('1', { name: 'cmu renamed', paths: ['cmu'] }),
    );
    expect(names(await firstValueFrom(service.scopes$))).toEqual([
      'cmu renamed',
    ]);

    await firstValueFrom(service.delete('1'));
    expect(await firstValueFrom(service.scopes$)).toEqual([]);
  });

  /**
   * Verifies: a project's access is null until loaded, then published for that project only.
   * Interacts with: ModuleScopesService.getProjectModuleScopes (stub).
   * Data: project p1 restricted to cmu.
   */
  it('publishes a project access once it is loaded', async () => {
    const access: ProjectModuleAccess = {
      projectId: 'p1',
      restricted: true,
      paths: ['cmu'],
      scopes: [],
    };
    const service = setup({
      getProjectModuleScopes: vi.fn(() => of(access)),
    });
    expect(await firstValueFrom(service.projectAccess$('p1'))).toBeNull();

    await firstValueFrom(service.loadProjectAccess('p1'));

    expect(await firstValueFrom(service.projectAccess$('p1'))).toEqual(access);
    expect(await firstValueFrom(service.projectAccess$('p2'))).toBeNull();
  });

  /**
   * Verifies: after assignments change, only the scopes and projects already loaded here are read again.
   * Interacts with: getModuleScope and getProjectModuleScopes (stubs).
   * Data: scope s1 and project p1 loaded; s2 and p2 not.
   */
  it('re-reads only what is already loaded after assignments change', async () => {
    const api = {
      getModuleScopes: vi.fn(() =>
        of<ModuleScope[]>([{ id: 's1', name: 'a' }]),
      ),
      getModuleScope: vi.fn((id: string) => of<ModuleScope>({ id, name: 'a' })),
      getProjectModuleScopes: vi.fn((projectId: string) =>
        of<ProjectModuleAccess>({ projectId, restricted: false }),
      ),
    };
    const service = setup(api);
    await firstValueFrom(service.load());
    await firstValueFrom(service.loadProjectAccess('p1'));
    api.getProjectModuleScopes.mockClear();

    await firstValueFrom(
      service.assignmentsChanged(['p1', 'p2'], ['s1', 's2']),
    );

    expect(api.getModuleScope.mock.calls.map((x) => x[0])).toEqual(['s1']);
    expect(api.getProjectModuleScopes.mock.calls.map((x) => x[0])).toEqual([
      'p1',
    ]);
  });
});
