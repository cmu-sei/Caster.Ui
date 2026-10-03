// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import {
  CreateSnippetCommand,
  Module,
  ModulesService,
} from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { recordEmissions } from '../../test-utils/record-emissions';
import { ModuleQuery } from './module.query';
import { ModuleService } from './module.service';
import { initialModuleUiState, ModuleStore } from './module.store';

function mod(overrides: Partial<Module> = {}): Module {
  return {
    id: 'm1',
    name: 'vm',
    path: 'modules/vm',
    versions: [{ id: 'v1', name: '1.0.0' }],
    versionsCount: 1,
    ...overrides,
  };
}

/** Real ModuleStore, ModuleQuery and ModuleService; ModulesService stubbed. */
function setup(api: ApiStub<ModulesService> = {}, modules: Module[] = []) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: ModulesService, useValue: api },
    ]),
  });
  const store = TestBed.inject(ModuleStore);
  const query = TestBed.inject(ModuleQuery);
  const service = TestBed.inject(ModuleService);
  store.add(modules);
  return { service, store, query };
}

const boom = () => throwError(() => new Error('boom'));

describe('ModuleService', () => {
  describe('load and loadByDesignId', () => {
    /**
     * Verifies: load turns loading on immediately, asks for all modules with
     *   the given flags, upserts them with their versions and clears loading.
     * Interacts with: ModulesService.getAllModules (Subject stub); upsertMany.
     * Data: stored m1 without versions; the API returns m1 with two versions
     *   and new m2.
     */
    it('load() upserts the modules with versions and toggles loading', () => {
      const response$ = new Subject<Module[]>();
      const api = {
        getAllModules: vi.fn(() => response$),
      } satisfies ApiStub<ModulesService>;
      const { service, query } = setup(api, [mod({ versions: [] })]);

      const load$ = service.load(true, true);
      expect(query.getValue().loading).toBe(true);
      recordEmissions(load$);
      expect(api.getAllModules).toHaveBeenCalledWith(true, true);

      response$.next([
        mod({ versions: [{ id: 'v1' }, { id: 'v2' }], versionsCount: 2 }),
        mod({ id: 'm2', name: 'dns', versions: [] }),
      ]);

      expect(query.getEntity('m1').versions.map((v) => v.id)).toEqual([
        'v1',
        'v2',
      ]);
      expect(query.hasEntity('m2')).toBe(true);
      expect(query.ui.getEntity('m2')).toEqual({
        id: 'm2',
        ...initialModuleUiState,
      });
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: without versions, load keeps the versions already stored for
     *   known modules (the payload's versions field is deleted first).
     * Interacts with: ModulesService.getAllModules (stub); upsertMany merge.
     * Data: stored m1 with version v1; the API returns m1 renamed with
     *   versions: null.
     */
    it('load(false) keeps stored versions', async () => {
      const payload = mod({ name: 'renamed', versions: null });
      const api = {
        getAllModules: vi.fn(() => of([payload])),
      } satisfies ApiStub<ModulesService>;
      const { service, query } = setup(api, [mod()]);

      await firstValueFrom(service.load(false, true));

      expect(query.getEntity('m1')).toMatchObject({
        name: 'renamed',
        versions: [{ id: 'v1', name: '1.0.0' }],
      });
      // NOTE: the API response object itself is mutated (versions deleted).
      expect(payload).not.toHaveProperty('versions');
    });

    /**
     * Verifies: loadByDesignId passes the design id as the fourth argument,
     *   with forceUpdate false.
     * Interacts with: ModulesService.getAllModules (stub).
     * Data: design g1, versions and counts requested.
     */
    it('loadByDesignId() filters by design', async () => {
      const api = {
        getAllModules: vi.fn(() => of([mod()])),
      } satisfies ApiStub<ModulesService>;
      const { service, query } = setup(api);

      await firstValueFrom(service.loadByDesignId('g1', true, false));

      expect(api.getAllModules).toHaveBeenCalledWith(true, false, false, 'g1');
      expect(query.getAll()).toEqual([mod()]);
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('loading flag on API errors', () => {
    const rows: {
      method: string;
      api: () => ApiStub<ModulesService>;
      call: (s: ModuleService) => Observable<unknown>;
    }[] = [
      {
        method: 'load',
        api: () => ({ getAllModules: vi.fn(boom) }),
        call: (s) => s.load(true, true),
      },
      {
        method: 'loadByDesignId',
        api: () => ({ getAllModules: vi.fn(boom) }),
        call: (s) => s.loadByDesignId('g1', true, true),
      },
      {
        method: 'loadModuleById',
        api: () => ({ getModule: vi.fn(boom) }),
        call: (s) => s.loadModuleById('m1'),
      },
      {
        method: 'createOrUpdateModuleById',
        api: () => ({ createTerrraformModuleFromRepository: vi.fn(boom) }),
        call: (s) => s.createOrUpdateModuleById('42'),
      },
    ];

    /**
     * Verifies: each loading-tracked call passes the error on and leaves the
     *   loading flag on.
     * Interacts with: the named ModulesService method (throwError stub);
     *   ModuleStore.setLoading.
     * Data: stored m1 (loading false); the API errors with 'boom'.
     */
    it.each(rows)(
      '$method leaves loading on when the API fails',
      async ({ api, call }) => {
        const { service, query } = setup(api(), [mod()]);
        expect(query.getValue().loading).toBe(false);

        const error = await firstValueFrom(call(service)).catch(
          (e: unknown) => e,
        );

        expect(error).toEqual(new Error('boom'));
        expect(query.getValue().loading).toBe(true);
      },
    );
  });

  describe('single modules', () => {
    /**
     * Verifies: loadModuleById upserts the module, marks it saved and clears
     *   loading.
     * Interacts with: ModulesService.getModule (stub); setSaved.
     * Data: empty store; the API returns m1.
     */
    it('loadModuleById() stores the module as saved', async () => {
      const api = {
        getModule: vi.fn(() => of(mod())),
      } satisfies ApiStub<ModulesService>;
      const { service, query } = setup(api);

      expect(await firstValueFrom(service.loadModuleById('m1'))).toEqual(mod());

      expect(api.getModule).toHaveBeenCalledWith('m1');
      expect(query.getEntity('m1')).toEqual(mod());
      expect(query.ui.getEntity('m1').isSaved).toBe(true);
      expect(query.getValue().loading).toBe(false);
    });

    /**
     * Verifies: createOrUpdateModuleById sends the repository id, upserts the
     *   resulting module and marks it saved.
     * Interacts with: ModulesService.createTerrraformModuleFromRepository (stub).
     * Data: stored m1 (unsaved); repository id '42' maps to m1 with a new
     *   version.
     */
    it('createOrUpdateModuleById() imports the repository module', async () => {
      const api = {
        createTerrraformModuleFromRepository: vi.fn(() =>
          of(mod({ versions: [{ id: 'v1' }, { id: 'v2' }] })),
        ),
      } satisfies ApiStub<ModulesService>;
      const { service, query } = setup(api, [mod()]);

      await firstValueFrom(service.createOrUpdateModuleById('42'));

      expect(api.createTerrraformModuleFromRepository).toHaveBeenCalledWith({
        id: '42',
      });
      expect(query.getEntity('m1').versions).toHaveLength(2);
      expect(query.ui.getEntity('m1').isSaved).toBe(true);
    });

    /**
     * Verifies: delete removes the module and its UI state after the API
     *   succeeds, and keeps it when the API fails.
     * Interacts with: ModulesService.deleteModule (stubs).
     * Data: stored m1 and m2; delete m1 (ok), then m2 (error).
     */
    it('delete() removes the module only on success', async () => {
      const api = {
        deleteModule: vi.fn((id: string) =>
          id === 'm1' ? of('m1') : throwError(() => new Error('in use')),
        ),
      } satisfies ApiStub<ModulesService>;
      const { service, query } = setup(api, [
        mod(),
        mod({ id: 'm2', name: 'dns' }),
      ]);

      await firstValueFrom(service.delete('m1'));
      const error = await firstValueFrom(service.delete('m2')).catch(
        (e: unknown) => e,
      );

      expect(query.getAll().map((m) => m.id)).toEqual(['m2']);
      expect(query.ui.hasEntity('m1')).toBe(false);
      expect(error).toEqual(new Error('in use'));
    });

    /**
     * Verifies: createVersionSnippet forwards the command and returns the
     *   snippet text.
     * Interacts with: ModulesService.createSnippet (stub).
     * Data: a snippet command for version v1.
     */
    it('createVersionSnippet() returns the snippet', async () => {
      const api = {
        createSnippet: vi.fn(() => of('module "web" {}')),
      } satisfies ApiStub<ModulesService>;
      const { service } = setup(api);
      const command: CreateSnippetCommand = {
        versionId: 'v1',
        moduleName: 'web',
      };

      expect(await firstValueFrom(service.createVersionSnippet(command))).toBe(
        'module "web" {}',
      );
      expect(api.createSnippet).toHaveBeenCalledWith(command);
    });
  });

  describe('UI state', () => {
    /**
     * Verifies: toggleSelected flips isSelected; for a module without UI
     *   state it creates a UI entity with isSelected undefined.
     * Interacts with: ModuleStore.ui.upsert; isUpdate.
     * Data: stored m1; unknown m9.
     */
    it('toggleSelected() flips the selection', () => {
      const { service, query } = setup({}, [mod()]);

      service.toggleSelected('m1');
      expect(query.ui.getEntity('m1').isSelected).toBe(true);
      service.toggleSelected('m1');
      expect(query.ui.getEntity('m1').isSelected).toBe(false);

      service.toggleSelected('m9');
      expect(query.ui.getEntity('m9')).toEqual({
        id: 'm9',
        isSelected: undefined,
      });
    });

    /**
     * Verifies: setSaved sets the flag explicitly, and setActive marks the
     *   module active in both the entity store and the UI store.
     * Interacts with: ModuleStore.ui.upsert; setActive on both stores.
     * Data: stored m1.
     */
    it('setSaved() and setActive()', () => {
      const { service, query } = setup({}, [mod()]);

      service.setSaved('m1', true);
      service.setActive('m1');

      expect(query.ui.getEntity('m1').isSaved).toBe(true);
      expect(query.getValue().active).toBe('m1');
      expect(query.ui.getValue().active).toBe('m1');
    });
  });
});
