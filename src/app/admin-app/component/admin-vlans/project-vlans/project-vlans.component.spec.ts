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

async function renderProjectVlans(
  canEdit: boolean,
  shownProjects: Project[] = projects,
) {
  const projectsApi = {
    getAllProjects: vi.fn((_onlyMine?: boolean) =>
      of<Project[]>(structuredClone(projects)),
    ),
  } satisfies ApiStub<ProjectsService>;
  const vlansApi = {
    getPools: vi.fn(() => of<Pool[]>([{ id: 'pool1', name: 'Main' }])),
    getPartitions: vi.fn(() =>
      of<Partition[]>([
        { id: 'part1', name: 'Blue', poolId: 'pool1' },
        { id: 'part2', name: 'Amber', poolId: 'pool1' },
      ]),
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
    inputs: { projects: shownProjects, canEdit },
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

  /**
   * Verifies: the Name and Partition headers sort the table, Partition by the assigned partition's name.
   * Interacts with: MatSort wired to the data source, the partition sortingDataAccessor, real PartitionQuery.
   * Data: projects Range (Blue), Zulu (Amber) and Alpha (none); pool Main with partitions Blue and Amber.
   */
  it('sorts the projects by name and by partition name', async () => {
    const { user } = await renderProjectVlans(true, [
      { id: 'p1', name: 'Range', partitionId: 'part1' },
      { id: 'p2', name: 'Zulu', partitionId: 'part2' },
      { id: 'p3', name: 'Alpha', partitionId: null },
    ]);
    const names = () =>
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].textContent.trim());

    expect(names()).toEqual(['Range', 'Zulu', 'Alpha']);
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['Alpha', 'Range', 'Zulu']);
    await user.click(screen.getByRole('button', { name: 'Partition' }));
    expect(names()).toEqual(['Alpha', 'Zulu', 'Range']);
  });
});
