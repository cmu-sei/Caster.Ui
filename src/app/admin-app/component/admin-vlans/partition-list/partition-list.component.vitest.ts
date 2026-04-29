// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';
import { PartitionListComponent } from './partition-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderList() {
  const loadVlans = vi.fn(() => of([]));
  const loadPartitions = vi.fn(() => of([]));
  const create = vi.fn(() => of({}));
  const selectByPoolId = vi.fn(() => of([]));

  const rendered = await renderComponent(PartitionListComponent, {
    declarations: [PartitionListComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { canEdit: true },
    providers: [
      { provide: VlanService, useValue: { loadByPoolId: loadVlans } },
      {
        provide: PartitionService,
        useValue: { loadByPoolId: loadPartitions, create },
      },
      { provide: PartitionQuery, useValue: { selectByPoolId } },
    ],
  });
  return { ...rendered, loadVlans, loadPartitions, create, selectByPoolId };
}

describe('PartitionListComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('setting poolId loads vlans and partitions and wires the partitions$ stream', async () => {
    const { fixture, loadVlans, loadPartitions, selectByPoolId } = await renderList();
    fixture.componentInstance.poolId = 'pool-1';
    expect(loadVlans).toHaveBeenCalledWith('pool-1');
    expect(loadPartitions).toHaveBeenCalledWith('pool-1');
    expect(selectByPoolId).toHaveBeenCalledWith('pool-1');
  });

  it('poolId getter returns the last set value', async () => {
    const { fixture } = await renderList();
    fixture.componentInstance.poolId = 'pool-2';
    expect(fixture.componentInstance.poolId).toBe('pool-2');
  });

  it('createPartition dispatches to the service with the current poolId', async () => {
    const { fixture, create } = await renderList();
    fixture.componentInstance.poolId = 'pool-7';
    fixture.componentInstance.createPartition();
    expect(create).toHaveBeenCalledWith('pool-7');
  });
});
