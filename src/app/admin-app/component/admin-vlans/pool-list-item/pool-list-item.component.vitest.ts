// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { Pool } from 'src/app/generated/caster-api';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { PoolListItemComponent } from './pool-list-item.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const pool: Pool = { id: 'pool-1', name: 'Alpha' } as Pool;

async function renderItem(overrides: { confirmCancel?: boolean } = {}) {
  const { confirmCancel = false } = overrides;
  const poolService = {
    partialEdit: vi.fn(() => of({})),
    delete: vi.fn(() => of({})),
  };
  const confirmDialog = vi.fn(() => of({ wasCancelled: confirmCancel }));
  const rendered = await renderComponent(PoolListItemComponent, {
    declarations: [PoolListItemComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { pool, canEdit: true },
    providers: [
      { provide: ConfirmDialogService, useValue: { confirmDialog } },
      { provide: PoolService, useValue: poolService },
    ],
  });
  return { ...rendered, poolService, confirmDialog };
}

describe('PoolListItemComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderItem();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('rename() dispatches partialEdit with the new name', async () => {
    const { fixture, poolService } = await renderItem();
    fixture.componentInstance.rename({ value: 'Renamed' });
    expect(poolService.partialEdit).toHaveBeenCalledWith('pool-1', {
      name: 'Renamed',
    });
  });

  it('selectPool() emits the pool on poolSelected', async () => {
    const { fixture } = await renderItem();
    const spy = vi.fn();
    fixture.componentInstance.poolSelected.subscribe(spy);
    fixture.componentInstance.selectPool(pool);
    expect(spy).toHaveBeenCalledWith(pool);
  });

  it('deletePool() dispatches when confirm is not cancelled', async () => {
    const { fixture, poolService } = await renderItem({ confirmCancel: false });
    fixture.componentInstance.deletePool(pool);
    expect(poolService.delete).toHaveBeenCalledWith('pool-1', false);
  });

  it('deletePool() is a no-op when confirm is cancelled', async () => {
    const { fixture, poolService } = await renderItem({ confirmCancel: true });
    fixture.componentInstance.deletePool(pool);
    expect(poolService.delete).not.toHaveBeenCalled();
  });
});
