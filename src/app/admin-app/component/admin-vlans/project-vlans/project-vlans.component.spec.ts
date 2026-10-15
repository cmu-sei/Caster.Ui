// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import {
  Partition,
  Pool,
  Project,
  ProjectsService,
  VlansService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectVlansComponent } from './project-vlans.component';

const projects: Project[] = [{ id: 'p1', name: 'Range', partitionId: null }];

async function renderProjectVlans(canEdit: boolean) {
  const projectsApi = {
    getAllProjects: vi.fn((_onlyMine?: boolean) =>
      of<Project[]>(structuredClone(projects)),
    ),
  } satisfies ApiStub<ProjectsService>;
  const vlansApi = {
    getPools: vi.fn(() => of<Pool[]>([{ id: 'pool1', name: 'Main' }])),
    getPartitions: vi.fn(() =>
      of<Partition[]>([{ id: 'part1', name: 'Blue', poolId: 'pool1' }]),
    ),
    assignPartition: vi.fn((_id: string) =>
      of<Project>({ id: 'p1', name: 'Range', partitionId: 'part1' }),
    ),
  } satisfies ApiStub<VlansService>;
  const view = await renderComponent(ProjectVlansComponent, {
    imports: [
      MatTableModule,
      MatSortModule,
      MatFormFieldModule,
      MatSelectModule,
      MatProgressBarModule,
    ],
    providers: [
      { provide: ProjectsService, useValue: projectsApi },
      { provide: VlansService, useValue: vlansApi },
    ],
    inputs: { projects, canEdit },
  });
  return { ...view, vlansApi, user: userEvent.setup() };
}

describe('ProjectVlansComponent', () => {
  /**
   * Verifies: with canEdit a project's partition can be picked from the pool's partitions, which assigns it through the API.
   * Interacts with: VlansService.getPools, getPartitions and assignPartition (stubs), real ProjectService, PoolQuery and PartitionQuery.
   * Data: project Range; pool Main with partition Blue; canEdit true.
   */
  it('assigns a partition when canEdit is true', async () => {
    const { vlansApi, user } = await renderProjectVlans(true);

    await user.click(within(screen.getByRole('table')).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Blue' }));

    expect(vlansApi.assignPartition).toHaveBeenCalledWith('part1', {
      projectId: 'p1',
    });
  });

  /**
   * Verifies: without canEdit the partition select of every project is disabled.
   * Interacts with: the [disabled]="!canEdit" binding on mat-select.
   * Data: project Range; canEdit false.
   */
  it('disables the partition select when canEdit is false', async () => {
    await renderProjectVlans(false);

    const table = screen.getByRole('table');
    expect(within(table).getByText('Range')).toBeInTheDocument();
    expect(within(table).getByRole('combobox')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
