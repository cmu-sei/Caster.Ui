// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  CreateVariableCommand,
  EditVariableCommand,
  Variable,
  VariablesService,
  VariableType,
} from '../../../generated/caster-api';
import { ApiStub } from '../../../test-utils/api-stub';
import { getDefaultProviders } from '../../../test-utils/default-test-providers';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../../test-utils/unhandled-rx-errors';
import { VariableService } from './variables.service';
import { VariablesQuery } from './variables.query';
import { VariablesStore } from './variables.store';

function variable(overrides: Partial<Variable> = {}): Variable {
  return {
    id: 'v1',
    designId: 'g1',
    name: 'region',
    type: VariableType.String,
    ...overrides,
  };
}

/** Real VariablesStore, VariablesQuery and VariableService; API stubbed. */
function setup(
  api: ApiStub<VariablesService> = {},
  variables: Variable[] = [],
) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: VariablesService, useValue: api },
    ]),
  });
  const store = TestBed.inject(VariablesStore);
  const query = TestBed.inject(VariablesQuery);
  const service = TestBed.inject(VariableService);
  store.add(variables);
  return { service, store, query };
}

describe('VariableService', () => {
  /**
   * Verifies: loadByDesignId subscribes itself and replaces the store with
   *   the design's variables, dropping those of other designs.
   * Interacts with: VariablesService.getVariablesByDesign (stub).
   * Data: stored v9 of design g9; the API returns v1 and v2 of g1.
   */
  it('loadByDesignId() replaces the store with the design variables', () => {
    const api = {
      getVariablesByDesign: vi.fn(() =>
        of([variable(), variable({ id: 'v2', name: 'count' })]),
      ),
    } satisfies ApiStub<VariablesService>;
    const { service, query } = setup(api, [
      variable({ id: 'v9', designId: 'g9' }),
    ]);

    service.loadByDesignId('g1');

    expect(api.getVariablesByDesign).toHaveBeenCalledWith('g1');
    expect(query.getAll().map((v) => v.id)).toEqual(['v2', 'v1']);
  });

  /**
   * Verifies: a failed loadByDesignId keeps the store, and the error is not
   *   handled by the service.
   * Interacts with: VariablesService.getVariablesByDesign (throwError stub).
   * Data: stored v1; the API errors with 'boom'.
   */
  it('loadByDesignId() does not handle API errors', async () => {
    const errors = captureUnhandledRxErrors();
    const { service, query } = setup(
      {
        getVariablesByDesign: vi.fn(() => throwError(() => new Error('boom'))),
      },
      [variable()],
    );

    service.loadByDesignId('g1');
    await flush();

    expect(query.getAll()).toEqual([variable()]);
    expect(errors).toEqual([new Error('boom')]);
  });

  /**
   * Verifies: create and edit return the API call, and delete fires the
   *   request itself; none of them touch the store (hub events do).
   * Interacts with: VariablesService create/edit/delete (stubs).
   * Data: stored v1.
   */
  it('forwards create, edit and delete to the API', async () => {
    const api = {
      createVariable: vi.fn(() => of(variable({ id: 'v9' }))),
      editVariable: vi.fn(() => of(variable({ name: 'renamed' }))),
      deleteVariable: vi.fn(() => of(undefined)),
    } satisfies ApiStub<VariablesService>;
    const { service, query } = setup(api, [variable()]);
    const create: CreateVariableCommand = {
      designId: 'g1',
      name: 'new',
      type: VariableType.Bool,
    };
    const edit: EditVariableCommand = { name: 'renamed' };

    expect((await firstValueFrom(service.create(create))).id).toBe('v9');
    await firstValueFrom(service.edit('v1', edit));
    service.delete('v1');

    expect(api.createVariable).toHaveBeenCalledWith(create);
    expect(api.editVariable).toHaveBeenCalledWith('v1', edit);
    expect(api.deleteVariable).toHaveBeenCalledWith('v1');
    expect(query.getAll()).toEqual([variable()]);
  });

  /**
   * Verifies: the hub handlers add, merge-update and remove variables.
   * Interacts with: VariablesStore.add/update/remove.
   * Data: stored v1; add v2; update v1's default; remove v2.
   */
  it('applies hub add, update and remove', () => {
    const { service, query } = setup({}, [variable()]);

    service.add(variable({ id: 'v2', name: 'count' }));
    service.update('v1', { defaultValue: 'us-east' });
    service.remove('v2');

    expect(query.getAll()).toEqual([variable({ defaultValue: 'us-east' })]);
  });
});
