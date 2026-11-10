// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import {
  AssignmentsService,
  ProjectGroup,
  ProjectGroupsService,
  ProjectsService,
  SystemPermission,
  UsersService,
  GroupsService,
  ProjectRolesService,
  EnvironmentSetsService,
  InventoryService,
  VlansService,
} from 'src/app/generated/caster-api';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectGroupDetailComponent } from './project-group-detail.component';

const group = (canManage: boolean): ProjectGroup => ({
  id: 'g1',
  name: 'Range A',
  projects: [{ id: 'p1', name: 'Blue Team' }],
  environmentSets: [{ id: 's1', name: 'Proxmox' }],
  inventoryConnections: ['lab-pve'],
  hosts: [],
  canManage,
});

async function renderDetail(canManage: boolean, grants: PermissionGrants = {}) {
  const groupsApi = {
    getProjectGroupMemberships: vi.fn(() =>
      of([
        {
          id: 'm1',
          projectGroupId: 'g1',
          userId: 'u1',
          userName: 'Alice',
          roleId: 'r1',
          roleName: 'Manager',
        },
      ]),
    ),
    getProjectGroup: vi.fn(() => of(group(canManage))),
    getProjectGroups: vi.fn(() =>
      of([group(canManage), { id: 'g2', name: 'Lab' }]),
    ),
    addProjectToProjectGroup: vi.fn(() => of(group(canManage))),
  };
  const assignments = { editAssignments: vi.fn(() => of<unknown>(null)) };
  const view = await renderComponent(ProjectGroupDetailComponent, {
    inputs: { group: group(canManage) },
    providers: [
      ...permissionDataProviders(grants),
      { provide: ProjectGroupsService, useValue: groupsApi },
      { provide: AssignmentsService, useValue: assignments },
      {
        provide: ProjectsService,
        useValue: {
          getAllProjects: vi.fn(() =>
            of([
              { id: 'p1', name: 'Blue Team', projectGroupId: 'g1' },
              { id: 'p2', name: 'Red Team', projectGroupId: 'g2' },
            ]),
          ),
        },
      },
      {
        provide: UsersService,
        useValue: {
          getAllUsers: vi.fn(() =>
            of([
              { id: 'u1', name: 'Alice' },
              { id: 'u2', name: 'Bob' },
            ]),
          ),
        },
      },
      {
        provide: GroupsService,
        useValue: { getAllGroups: vi.fn(() => of([])) },
      },
      {
        provide: ProjectRolesService,
        useValue: {
          getAllProjectRoles: vi.fn(() => of([{ id: 'r1', name: 'Manager' }])),
        },
      },
      {
        provide: EnvironmentSetsService,
        useValue: {
          getEnvironmentSets: vi.fn(() =>
            of([
              { id: 's1', name: 'Proxmox' },
              { id: 's2', name: 'vSphere' },
            ]),
          ),
        },
      },
      {
        provide: InventoryService,
        useValue: { getInventoryConnections: vi.fn(() => of([])) },
      },
      {
        provide: VlansService,
        useValue: { getPartitions: vi.fn(() => of([])) },
      },
    ],
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  return { ...view, groupsApi, assignments, user: userEvent.setup() };
}

describe('ProjectGroupDetailComponent', () => {
  /**
   * Verifies: a member who doesn't manage the group sees what it holds, with no checkboxes and no Memberships tab.
   * Interacts with: the group input; ProjectGroupsService.getProjectGroupMemberships (stub, not called).
   * Data: Range A with one project, set and connection; canManage false.
   */
  it('shows a member what the group holds, read-only', async () => {
    const { groupsApi, user } = await renderDetail(false);

    expect(screen.getByText('Blue Team')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Memberships' })).toBeNull();
    expect(groupsApi.getProjectGroupMemberships).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'Environment Sets' }));
    expect(screen.getByText('Proxmox')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    expect(screen.getByText('lab-pve')).toBeInTheDocument();
  });

  /**
   * Verifies: a group manager searches and checks projects to add, a project in another group says it moves, and Save adds it.
   * Interacts with: ProjectGroupsService.addProjectToProjectGroup and getProjectGroup (stubs).
   * Data: canManage true; Red Team is in Lab.
   */
  it('lets a group manager add a project from another group', async () => {
    const { user, groupsApi } = await renderDetail(true);

    expect(screen.getByText('moves from Lab')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Red Team/ }));
    await user.click(screen.getByRole('button', { name: 'Save 1 change' }));

    expect(groupsApi.addProjectToProjectGroup).toHaveBeenCalledWith('g1', 'p2');
    expect(groupsApi.getProjectGroup).toHaveBeenCalledWith('g1');
  });

  /**
   * Verifies: a group manager sees the memberships in the searchable member tables, but the group's sets stay read-only without ManageEnvironmentSets.
   * Data: canManage true; no system permissions; Alice is a member, Bob is not.
   */
  it("lets a group manager manage memberships, not the group's sets", async () => {
    const { user } = await renderDetail(true);

    await user.click(screen.getByRole('tab', { name: 'Memberships' }));
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Environment Sets' }));
    expect(screen.queryByRole('checkbox', { name: /Proxmox/ })).toBeNull();
  });

  /**
   * Verifies: ManageEnvironmentSets changes the group's sets in one save through the assignments API.
   * Interacts with: AssignmentsService.editAssignments and ProjectGroupsService.getProjectGroup (stubs).
   * Data: canManage false; ManageEnvironmentSets; swap Proxmox for vSphere.
   */
  it("saves the group's sets together", async () => {
    const { user, assignments } = await renderDetail(false, {
      system: [SystemPermission.ManageEnvironmentSets],
    });

    await user.click(screen.getByRole('tab', { name: 'Environment Sets' }));
    await user.click(screen.getByRole('checkbox', { name: /Proxmox/ }));
    await user.click(screen.getByRole('checkbox', { name: /vSphere/ }));
    await user.click(screen.getByRole('button', { name: 'Save 2 changes' }));

    expect(assignments.editAssignments).toHaveBeenCalledWith({
      changes: [
        { operation: 'Add', projectGroupId: 'g1', environmentSetId: 's2' },
        { operation: 'Remove', projectGroupId: 'g1', environmentSetId: 's1' },
      ],
    });
  });
});
