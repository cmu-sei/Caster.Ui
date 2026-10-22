// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  Design,
  DesignsService,
  EditDesignCommand,
} from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import {
  captureUnhandledRxErrors,
  flush,
} from '../../test-utils/unhandled-rx-errors';
import { DesignQuery } from './design.query';
import { DesignService } from './design.service';
import { DesignStore } from './design.store';

function design(overrides: Partial<Design> = {}): Design {
  return {
    id: 'g1',
    name: 'Network',
    directoryId: 'd1',
    enabled: true,
    ...overrides,
  };
}

/** Real DesignStore, DesignQuery and DesignService; DesignsService stubbed. */
function setup(
  designsApi: ApiStub<DesignsService> = {},
  designs: Design[] = [],
) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: DesignsService, useValue: designsApi },
    ]),
  });
  const store = TestBed.inject(DesignStore);
  const query = TestBed.inject(DesignQuery);
  const service = TestBed.inject(DesignService);
  store.add(designs);
  return { service, store, query };
}

describe('DesignService', () => {
  /**
   * Verifies: the store is named 'designs' and the query keeps insertion
   *   order (DesignQuery has no @QueryConfig sort).
   * Interacts with: DesignStore, DesignQuery.getAll.
   * Data: designs 'Zeta' then 'Alpha'.
   */
  it('stores designs in insertion order under the designs store', () => {
    const { store, query } = setup({}, [
      design({ id: 'z', name: 'Zeta' }),
      design({ id: 'a', name: 'Alpha' }),
    ]);

    expect(store.storeName).toBe('designs');
    expect(query.getAll().map((d) => d.id)).toEqual(['z', 'a']);
  });

  /**
   * Verifies: setDesigns replaces every stored design.
   * Interacts with: DesignStore.set.
   * Data: stored g1; set to [g2].
   */
  it('setDesigns() replaces the stored designs', () => {
    const { service, query } = setup({}, [design()]);

    service.setDesigns([design({ id: 'g2', name: 'Other' })]);

    expect(query.getAll().map((d) => d.id)).toEqual(['g2']);
  });

  /**
   * Verifies: the hub handlers add a design, merge a partial update and
   *   remove a design; add() ignores an id that is already stored.
   * Interacts with: DesignStore.add/update/remove.
   * Data: stored g1; add g1 again (renamed) and g2; update g1; remove g2.
   */
  it('applies hub add, update and remove', () => {
    const { service, query } = setup({}, [design()]);

    service.add(design({ name: 'Ignored' }));
    service.add(design({ id: 'g2', name: 'Second' }));
    service.update('g1', { enabled: false });
    service.remove('g2');

    expect(query.getAll()).toEqual([design({ enabled: false })]);
  });

  /**
   * Verifies: create, edit, delete and toggleEnabled only call the API; the
   *   store changes later through the Design* hub events.
   * Interacts with: DesignsService create/edit/delete/enable/disable (stubs).
   * Data: stored enabled g1 and disabled g2.
   */
  it('sends commands to the API without touching the store', () => {
    const designsApi = {
      createDesign: vi.fn(() => of(design({ id: 'g9' }))),
      editDesign: vi.fn((_id: string, _command?: EditDesignCommand) =>
        of(design({ name: 'Edited' })),
      ),
      deleteDesign: vi.fn(() => of(undefined)),
      disableDesign: vi.fn(() => of(design({ enabled: false }))),
      enableDesign: vi.fn(() => of(design({ id: 'g2', enabled: true }))),
    } satisfies ApiStub<DesignsService>;
    const stored = [
      design(),
      design({ id: 'g2', name: 'Off', enabled: false }),
    ];
    const { service, query } = setup(designsApi, stored);
    const edit = { name: 'Edited' };

    service.create(design({ id: undefined, name: 'New' }));
    service.edit('g1', edit);
    service.delete('g1');
    service.toggleEnabled(stored[0]);
    service.toggleEnabled(stored[1]);

    expect(designsApi.createDesign).toHaveBeenCalledWith(
      design({ id: undefined, name: 'New' }),
    );
    expect(designsApi.editDesign).toHaveBeenCalledWith('g1', edit);
    expect(designsApi.editDesign.mock.calls[0][1]).not.toBe(edit);
    expect(designsApi.deleteDesign).toHaveBeenCalledWith('g1');
    expect(designsApi.disableDesign).toHaveBeenCalledWith('g1');
    expect(designsApi.enableDesign).toHaveBeenCalledWith('g2');
    expect(query.getAll()).toEqual(stored);
  });

  /**
   * Verifies: a failed command is not handled by the service; the error
   *   reaches rxjs's unhandled-error hook.
   * Interacts with: DesignsService.createDesign (throwError stub).
   * Data: the API errors with 'boom'.
   */
  it('does not handle API errors from fire-and-forget commands', async () => {
    const errors = captureUnhandledRxErrors();
    const { service } = setup({
      createDesign: vi.fn(() => throwError(() => new Error('boom'))),
    });

    service.create(design());
    await flush();

    expect(errors).toEqual([new Error('boom')]);
  });
});
