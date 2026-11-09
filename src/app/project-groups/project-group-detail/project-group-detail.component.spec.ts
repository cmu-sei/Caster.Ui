// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
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
  };
  const view = await renderComponent(ProjectGroupDetailComponent, {
    inputs: { group: group(canManage) },
    providers: [
      ...permissionDataProviders(grants),
      { provide: ProjectGroupsService, useValue: groupsApi },
      {
        provide: ProjectsService,
        useValue: { getAllProjects: vi.fn(() => of([])) },
      },
      { provide: UsersService, useValue: { getAllUsers: vi.fn(() => of([])) } },
      {
        provide: GroupsService,
        useValue: { getAllGroups: vi.fn(() => of([])) },
      },
      {
        provide: ProjectRolesService,
        useValue: { getAllProjectRoles: vi.fn(() => of([])) },
      },
      {
        provide: EnvironmentSetsService,
        useValue: { getEnvironmentSets: vi.fn(() => of([])) },
      },
      {
        provide: InventoryService,
        useValue: { getInventoryConnections: vi.fn(() => of([])) },
      },
      {
        provide: VlansService,
        useValue: { getPartitions: vi.fn(() => of([])) },
      },
      { provide: CrucibleDialogService, useValue: { confirm: vi.fn() } },
    ],
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  return { ...view, groupsApi };
}

describe('ProjectGroupDetailComponent', () => {
  /**
   * Verifies: a member who doesn't manage the group sees what it holds, with no controls and no memberships.
   * Interacts with: the group input; ProjectGroupsService.getProjectGroupMemberships (stub, not called).
   * Data: Range A with one project, set and connection; canManage false.
   */
  it('shows a member what the group holds, read-only', async () => {
    const { groupsApi } = await renderDetail(false);

    expect(screen.getByText('Blue Team')).toBeInTheDocument();
    expect(screen.getByText('Proxmox')).toBeInTheDocument();
    expect(screen.getByText('lab-pve')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove Blue Team' }),
    ).toBeNull();
    expect(groupsApi.getProjectGroupMemberships).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a group manager manages memberships and projects, but not the group's sets, which need ManageEnvironmentSets.
   * Interacts with: the Remove buttons; getProjectGroupMemberships (stub).
   * Data: canManage true; no system permissions.
   */
  it("lets a group manager manage memberships and projects, not the group's sets", async () => {
    await renderDetail(true);

    expect(
      screen.getByRole('button', { name: 'Remove Blue Team' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Proxmox' })).toBeNull();
  });

  /**
   * Verifies: ManageEnvironmentSets can take a set from the group.
   * Interacts with: PermissionService over stubbed system permissions.
   * Data: canManage false; ManageEnvironmentSets.
   */
  it('lets ManageEnvironmentSets manage the group sets', async () => {
    await renderDetail(false, {
      system: [SystemPermission.ManageEnvironmentSets],
    });

    expect(
      screen.getByRole('button', { name: 'Remove Proxmox' }),
    ).toBeInTheDocument();
  });
});
