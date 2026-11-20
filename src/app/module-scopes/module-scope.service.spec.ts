// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ModuleScope, ModuleScopesService } from '../generated/caster-api';
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
   * Verifies: create keeps the published list current without a reload.
   * Interacts with: ModuleScopesService.createModuleScope (stub).
   * Data: one scope created.
   */
  it('keeps the list current after create', async () => {
    const service = setup({
      createModuleScope: vi.fn(() =>
        of<ModuleScope>({ id: '1', name: 'cmu', paths: ['cmu'] }),
      ),
    });

    await firstValueFrom(service.create({ name: 'cmu', paths: ['cmu'] }));

    expect(names(await firstValueFrom(service.scopes$))).toEqual(['cmu']);
  });

  /**
   * Verifies: after assignments change, only the scopes already loaded here are read again.
   * Interacts with: getModuleScopes and getModuleScope (stubs).
   * Data: scope s1 loaded; s2 not.
   */
  it('re-reads only the loaded scopes after assignments change', async () => {
    const api = {
      getModuleScopes: vi.fn(() =>
        of<ModuleScope[]>([{ id: 's1', name: 'a' }]),
      ),
      getModuleScope: vi.fn((id: string) => of<ModuleScope>({ id, name: 'a' })),
    };
    const service = setup(api);
    await firstValueFrom(service.load());

    await firstValueFrom(service.assignmentsChanged(['s1', 's2']));

    expect(api.getModuleScope.mock.calls.map((x) => x[0])).toEqual(['s1']);
  });
});
