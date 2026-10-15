// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Partition, Vlan, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PartitionListComponent } from './partition-list.component';

@Component({ selector: 'cas-partition', template: '', standalone: false })
class PartitionStub {
  @Input() partition: Partition;
  @Input() poolId: string;
  @Input() canEdit: boolean;
}

async function renderPartitionList(canEdit: boolean) {
  const vlansApi = {
    getVlansByPool: vi.fn((_id: string) => of<Vlan[]>([])),
    getPartitionsByPool: vi.fn((poolId: string) =>
      of<Partition[]>([{ id: 'part1', name: 'Range', poolId }]),
    ),
    createPartition: vi.fn((poolId: string) =>
      of<Partition>({ id: 'part2', name: 'New Partition', poolId }),
    ),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(PartitionListComponent, {
    declarations: [PartitionStub],
    imports: [
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatExpansionModule,
    ],
    providers: [{ provide: VlansService, useValue: vlansApi }],
    inputs: { poolId: 'pool1', canEdit },
  });
  const partitions = (): PartitionStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(PartitionStub))
      .map((d) => d.componentInstance);
  return { ...view, vlansApi, partitions, user: userEvent.setup() };
}

describe('PartitionListComponent', () => {
  /**
   * Verifies: the pool's VLANs and partitions load, the pool-level item plus one item per partition render with canEdit true, and Create a Partition creates one.
   * Interacts with: VlansService.getVlansByPool, getPartitionsByPool and createPartition (stubs), real PartitionService and PartitionQuery.
   * Data: pool pool1 with partition Range; canEdit true.
   */
  it('lists and creates partitions when canEdit is true', async () => {
    const { vlansApi, partitions, user } = await renderPartitionList(true);

    expect(vlansApi.getVlansByPool).toHaveBeenCalledWith('pool1');
    expect(partitions().map((p) => p.partition?.id ?? p.poolId)).toEqual([
      'pool1',
      'part1',
    ]);
    expect(partitions().map((p) => p.canEdit)).toEqual([true, true]);

    await user.click(
      screen.getByRole('button', { name: 'Create a Partition' }),
    );
    expect(vlansApi.createPartition).toHaveBeenCalledWith('pool1', {
      name: 'New Partition',
    });
  });

  /**
   * Verifies: without canEdit there is no Create a Partition button and every partition item gets canEdit false.
   * Interacts with: the @if (canEdit) block, the partition stubs' canEdit inputs.
   * Data: pool pool1 with partition Range; canEdit false.
   */
  it('hides Create a Partition when canEdit is false', async () => {
    const { partitions } = await renderPartitionList(false);

    expect(
      screen.queryByRole('button', { name: 'Create a Partition' }),
    ).not.toBeInTheDocument();
    expect(partitions().map((p) => p.canEdit)).toEqual([false, false]);
  });
});
