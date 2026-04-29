// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom, of } from 'rxjs';
import { Partition, Pool, Project } from 'src/app/generated/caster-api';
import { ProjectService } from 'src/app/project/state/project.service';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { PoolQuery } from 'src/app/vlans/state/pool/pool.query';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { ProjectVlansComponent } from './project-vlans.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const pool: Pool = { id: 'pool-1', name: 'Alpha' } as Pool;
const partition: Partition = {
  id: 'part-1',
  poolId: 'pool-1',
  name: 'Default',
} as Partition;

async function renderPV() {
  const loadProjects = vi.fn(() => of([]));
  const poolLoad = vi.fn(() => of([]));
  const partitionLoad = vi.fn(() => of([]));
  const assignPartition = vi.fn(() => of({}));

  const rendered = await renderComponent(ProjectVlansComponent, {
    declarations: [ProjectVlansComponent],
    imports: [MatTableModule, MatSelectModule],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { projects: [], canEdit: true },
    providers: [
      {
        provide: ProjectService,
        useValue: { loadProjects, assignPartition },
      },
      { provide: PoolService, useValue: { load: poolLoad } },
      { provide: PartitionService, useValue: { load: partitionLoad } },
      { provide: PoolQuery, useValue: { selectAll: () => of([pool]) } },
      {
        provide: PartitionQuery,
        useValue: { selectAll: () => of([partition]) },
      },
    ],
  });

  return { ...rendered, loadProjects, poolLoad, partitionLoad, assignPartition };
}

describe('ProjectVlansComponent', () => {
  it('creates and loads data on init', async () => {
    const { fixture, loadProjects, poolLoad, partitionLoad } = await renderPV();
    expect(fixture.componentInstance).toBeTruthy();
    expect(loadProjects).toHaveBeenCalledWith(false);
    expect(poolLoad).toHaveBeenCalled();
    expect(partitionLoad).toHaveBeenCalled();
  });

  it('setting projects populates the data source', async () => {
    const { fixture } = await renderPV();
    const projects: Project[] = [{ id: 'pr1', name: 'Alpha' } as Project];
    fixture.componentInstance.projects = projects;
    expect(fixture.componentInstance.dataSource.data).toEqual(projects);
  });

  it('partitionOptions$ groups partitions by their pool', async () => {
    const { fixture } = await renderPV();
    const map = await firstValueFrom(
      fixture.componentInstance.partitionOptions$,
    );
    const parts = map.get(pool);
    expect(parts).toEqual([partition]);
  });

  it('updatePartition dispatches to ProjectService.assignPartition', async () => {
    const { fixture, assignPartition } = await renderPV();
    fixture.componentInstance.updatePartition('proj-1', 'part-1');
    expect(assignPartition).toHaveBeenCalledWith('proj-1', 'part-1');
  });
});
