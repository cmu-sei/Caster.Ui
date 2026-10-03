// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  AddOrUpdateValuesDesignModuleCommand,
  CreateDesignModuleCommand,
  DesignModule,
  DesignsModulesService,
  EditDesignModuleCommand,
} from '../../../generated/caster-api';
import { ApiStub } from '../../../test-utils/api-stub';
import { getDefaultProviders } from '../../../test-utils/default-test-providers';
import { DesignModuleQuery } from './design-module.query';
import { DesignModuleService } from './design-module.service';
import { DesignModuleStore } from './design-module.store';

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

/**
 * Real DesignModuleStore, DesignModuleQuery (with the real ModuleQuery) and
 * DesignModuleService; DesignsModulesService stubbed.
 */
function setup(
  api: ApiStub<DesignsModulesService> = {},
  designModules: DesignModule[] = [],
) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: DesignsModulesService, useValue: api },
    ]),
  });
  const store = TestBed.inject(DesignModuleStore);
  const query = TestBed.inject(DesignModuleQuery);
  const service = TestBed.inject(DesignModuleService);
  store.add(designModules);
  return { service, store, query };
}

describe('DesignModuleService', () => {
  /**
   * Verifies: the hub handlers add, merge-update and remove design modules.
   * Interacts with: DesignModuleStore.add/update/remove.
   * Data: stored dm1; add dm2; update dm1's version; remove dm2.
   */
  it('applies hub add, update and remove', () => {
    const { service, query } = setup({}, [designModule()]);

    service.add(designModule({ id: 'dm2', name: 'db' }));
    service.update('dm1', { moduleVersion: '2.0.0' });
    expect(query.getCount()).toBe(2);
    service.remove('dm2');

    expect(query.getAll()).toEqual([designModule({ moduleVersion: '2.0.0' })]);
  });

  /**
   * Verifies: loadByDesignId replaces the stored design modules with the
   *   design's list, which drops modules of other designs.
   * Interacts with: DesignsModulesService.getDesignModulesByDesign (stub).
   * Data: stored dm9 of design g9; the API returns dm1 and dm2 of g1.
   */
  it('loadByDesignId() replaces the store with the design modules', async () => {
    const api = {
      getDesignModulesByDesign: vi.fn(() =>
        of([designModule(), designModule({ id: 'dm2', name: 'db' })]),
      ),
    } satisfies ApiStub<DesignsModulesService>;
    const { service, query } = setup(api, [
      designModule({ id: 'dm9', designId: 'g9' }),
    ]);

    await firstValueFrom(service.loadByDesignId('g1'));

    expect(api.getDesignModulesByDesign).toHaveBeenCalledWith('g1');
    expect(query.getAll().map((m) => m.id)).toEqual(['dm2', 'dm1']);
  });

  /**
   * Verifies: a failed loadByDesignId leaves the store as it was and passes
   *   the error on.
   * Interacts with: DesignsModulesService.getDesignModulesByDesign
   *   (throwError stub).
   * Data: stored dm1; the API errors with 'boom'.
   */
  it('loadByDesignId() keeps the store when the API fails', async () => {
    const { service, query } = setup(
      {
        getDesignModulesByDesign: vi.fn(() =>
          throwError(() => new Error('boom')),
        ),
      },
      [designModule()],
    );

    const error = await firstValueFrom(service.loadByDesignId('g1')).catch(
      (e: unknown) => e,
    );

    expect(error).toEqual(new Error('boom'));
    expect(query.getAll()).toEqual([designModule()]);
  });

  /**
   * Verifies: load(id) upserts one design module, inserting it when new and
   *   merging it when stored.
   * Interacts with: DesignsModulesService.getDesignModule (stub).
   * Data: stored dm1; load dm1 (new version) and dm2.
   */
  it('load() upserts one design module', async () => {
    const api = {
      getDesignModule: vi.fn((id: string) =>
        of(
          id === 'dm1'
            ? designModule({ moduleVersion: '3.0.0' })
            : designModule({ id: 'dm2', name: 'db' }),
        ),
      ),
    } satisfies ApiStub<DesignsModulesService>;
    const { service, query } = setup(api, [designModule()]);

    await firstValueFrom(service.load('dm1'));
    await firstValueFrom(service.load('dm2'));

    expect(query.getEntity('dm1').moduleVersion).toBe('3.0.0');
    expect(query.getEntity('dm2').name).toBe('db');
  });

  /**
   * Verifies: create, edit, addOrUpdateValues and delete return the API call
   *   unchanged and leave the store to the hub events.
   * Interacts with: DesignsModulesService create/edit/addOrUpdateValues/delete
   *   (stubs).
   * Data: stored dm1; one command of each kind.
   */
  it('forwards commands and leaves the store to hub events', async () => {
    const api = {
      createDesignModule: vi.fn(() => of(designModule({ id: 'dm9' }))),
      editDesignModule: vi.fn(() => of(designModule({ name: 'renamed' }))),
      addOrUpdateValuesDesignModule: vi.fn(() => of(designModule())),
      deleteDesignModule: vi.fn(() => of(undefined)),
    } satisfies ApiStub<DesignsModulesService>;
    const { service, query } = setup(api, [designModule()]);
    const create: CreateDesignModuleCommand = {
      designId: 'g1',
      moduleId: 'm1',
      name: 'new',
    };
    const edit: EditDesignModuleCommand = { name: 'renamed' };
    const values: AddOrUpdateValuesDesignModuleCommand = {
      values: [{ name: 'size', value: 'large' }],
    };

    expect((await firstValueFrom(service.create(create))).id).toBe('dm9');
    await firstValueFrom(service.edit('dm1', edit));
    await firstValueFrom(service.addOrUpdateValues('dm1', values));
    await firstValueFrom(service.delete('dm1'));

    expect(api.createDesignModule).toHaveBeenCalledWith(create);
    expect(api.editDesignModule).toHaveBeenCalledWith('dm1', edit);
    expect(api.addOrUpdateValuesDesignModule).toHaveBeenCalledWith(
      'dm1',
      values,
    );
    expect(api.deleteDesignModule).toHaveBeenCalledWith('dm1');
    expect(query.getAll()).toEqual([designModule()]);
  });

  /**
   * Verifies: toggleEnabled disables an enabled module and enables a
   *   disabled one.
   * Interacts with: DesignsModulesService.disable/enableDesignModule (stubs).
   * Data: enabled dm1, disabled dm2.
   */
  it('toggleEnabled() calls the opposite endpoint', () => {
    const api = {
      disableDesignModule: vi.fn(() => of(designModule({ enabled: false }))),
      enableDesignModule: vi.fn(() => of(designModule({ id: 'dm2' }))),
    } satisfies ApiStub<DesignsModulesService>;
    const { service } = setup(api);

    service.toggleEnabled(designModule());
    service.toggleEnabled(designModule({ id: 'dm2', enabled: false }));

    expect(api.disableDesignModule).toHaveBeenCalledWith('dm1');
    expect(api.enableDesignModule).toHaveBeenCalledWith('dm2');
  });
});
