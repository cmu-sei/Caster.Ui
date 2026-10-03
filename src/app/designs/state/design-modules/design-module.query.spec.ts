// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { DesignModule, Module } from '../../../generated/caster-api';
import { ModuleQuery } from '../../../modules/state/module.query';
import { ModuleStore } from '../../../modules/state/module.store';
import { recordEmissions } from '../../../test-utils/record-emissions';
import { DesignModuleQuery } from './design-module.query';
import { DesignModuleStore } from './design-module.store';

// Real design-module and module stores and queries, no TestBed.

function designModule(overrides: Partial<DesignModule> = {}): DesignModule {
  return {
    id: 'dm1',
    designId: 'g1',
    moduleId: 'm1',
    name: 'web',
    moduleVersion: '1.0.0',
    enabled: true,
    ...overrides,
  };
}

const vmModule: Module = {
  id: 'm1',
  name: 'vm',
  versions: [
    { id: 'v1', name: '1.0.0', outputs: [{ name: 'ip' }, { name: 'id' }] },
    { id: 'v2', name: '2.0.0', outputs: [{ name: 'ip' }] },
  ],
};

function setup(designModules: DesignModule[] = [], modules: Module[] = []) {
  const store = new DesignModuleStore();
  const moduleStore = new ModuleStore();
  const query = new DesignModuleQuery(store, new ModuleQuery(moduleStore));
  store.add(designModules);
  moduleStore.add(modules);
  return { store, moduleStore, query };
}

describe('DesignModuleQuery', () => {
  /**
   * Verifies: getByDesignId returns only that design's modules, sorted by
   *   name.
   * Interacts with: selectAll({ filterBy }) + @QueryConfig sortBy 'name'.
   * Data: 'web' and 'db' in g1; 'app' in g2.
   */
  it('selects the modules of one design by name', async () => {
    const { query } = setup([
      designModule(),
      designModule({ id: 'dm2', name: 'db' }),
      designModule({ id: 'dm3', name: 'app', designId: 'g2' }),
    ]);

    const modules = await firstValueFrom(query.getByDesignId('g1'));

    expect(modules.map((m) => m.name)).toEqual(['db', 'web']);
  });

  /**
   * Verifies: getValues emits a design module's values and undefined for an
   *   unknown id.
   * Interacts with: selectEntity(values projection).
   * Data: dm1 with one value.
   */
  it('selects the values of a design module', async () => {
    const values = [{ name: 'size', value: 'large' }];
    const { query } = setup([{ ...designModule(), values }]);

    expect(await firstValueFrom(query.getValues('dm1'))).toEqual(values);
    expect(await firstValueFrom(query.getValues('missing'))).toBeUndefined();
  });

  describe('getOutputsByDesignId', () => {
    /**
     * Verifies: lists every output of each design module's selected module
     *   version as a Terraform reference, skipping the excluded module.
     * Interacts with: getByDesignId + ModuleQuery.selectAll via combineLatest.
     * Data: 'web' on vm 1.0.0 (ip, id) and 'db' on vm 2.0.0 (ip); then the
     *   same with 'db' excluded.
     */
    it('builds Terraform references for module outputs', async () => {
      const { query } = setup(
        [
          designModule(),
          designModule({ id: 'dm2', name: 'db', moduleVersion: '2.0.0' }),
        ],
        [vmModule],
      );

      expect(await firstValueFrom(query.getOutputsByDesignId('g1'))).toEqual([
        { designModuleName: 'db', name: 'ip', terraform: '${module.db.ip}' },
        { designModuleName: 'web', name: 'ip', terraform: '${module.web.ip}' },
        { designModuleName: 'web', name: 'id', terraform: '${module.web.id}' },
      ]);
      expect(
        await firstValueFrom(query.getOutputsByDesignId('g1', 'dm2')),
      ).toEqual([
        { designModuleName: 'web', name: 'ip', terraform: '${module.web.ip}' },
        { designModuleName: 'web', name: 'id', terraform: '${module.web.id}' },
      ]);
    });

    /**
     * Verifies: design modules whose module is not loaded, or whose version
     *   is not among the loaded versions, contribute no outputs; the stream
     *   re-emits once the module arrives.
     * Interacts with: ModuleQuery.selectAll (combineLatest re-emission).
     * Data: 'web' on vm 1.0.0 and 'old' on vm 0.9.0; modules loaded later.
     */
    it('skips unknown modules and versions, and updates when modules load', () => {
      const { moduleStore, query } = setup([
        designModule(),
        designModule({ id: 'dm2', name: 'old', moduleVersion: '0.9.0' }),
      ]);
      const seen = recordEmissions(query.getOutputsByDesignId('g1'));

      moduleStore.add(vmModule);

      expect(seen.map((outputs) => outputs.map((o) => o.terraform))).toEqual([
        [],
        ['${module.web.ip}', '${module.web.id}'],
      ]);
    });

    /**
     * Verifies: a matching module version without an outputs list makes the
     *   stream error.
     * Interacts with: `version?.outputs.forEach` in getOutputsByDesignId.
     * Data: 'web' on a vm 1.0.0 version whose outputs is null.
     */
    it('errors when the selected version has no outputs list', async () => {
      const { query } = setup(
        [designModule()],
        [
          {
            id: 'm1',
            name: 'vm',
            versions: [{ id: 'v1', name: '1.0.0', outputs: null }],
          },
        ],
      );

      // NOTE: the optional chain is on `version`, not `outputs`
      // (design-module.query.ts:56), so null outputs make `forEach` throw.
      // The generated type allows null, but caster.api initializes
      // ModuleVersion.Outputs to an empty list (Features/Modules/Module.cs:41),
      // so this can't happen against the real API today.
      await expect(
        firstValueFrom(query.getOutputsByDesignId('g1')),
      ).rejects.toThrow(TypeError);
    });
  });
});
