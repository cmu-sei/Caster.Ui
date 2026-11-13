// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import {
  ProjectGroup,
  ProjectGroupsService,
} from 'src/app/generated/caster-api';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { ProjectGroupService } from './project-group.service';

const lab: ProjectGroup = {
  id: 'g1',
  name: 'Lab',
  projects: [{ id: 'p1', name: 'Red Team' }],
};
const range: ProjectGroup = { id: 'g2', name: 'Range', projects: [] };

describe('ProjectGroupService', () => {
  /**
   * Verifies: adding a project to a group takes it out of the group it was in, as the API does, so that group's list doesn't keep it.
   * Interacts with: ProjectGroupsService.getProjectGroups and addProjectToProjectGroup (stubs).
   * Data: Red Team in Lab, moved to Range.
   */
  it('takes a moved project out of the group it left', async () => {
    const api = {
      getProjectGroups: vi.fn(() => of([lab, range])),
      addProjectToProjectGroup: vi.fn(() =>
        of<ProjectGroup>({
          ...range,
          projects: [{ id: 'p1', name: 'Red Team' }],
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: getDefaultProviders([
        { provide: ProjectGroupsService, useValue: api },
      ]),
    });
    const service = TestBed.inject(ProjectGroupService);

    await firstValueFrom(service.load());
    await firstValueFrom(service.addProject('g2', 'p1'));

    const groups = await firstValueFrom(service.groups$);
    expect(groups.find((x) => x.id === 'g1')?.projects).toEqual([]);
    expect(groups.find((x) => x.id === 'g2')?.projects).toEqual([
      { id: 'p1', name: 'Red Team' },
    ]);
  });
});
