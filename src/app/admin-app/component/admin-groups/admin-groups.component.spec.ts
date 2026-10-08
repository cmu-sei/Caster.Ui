// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  Group,
  GroupPermission,
  GroupsService,
  SystemPermission,
  User,
  UsersService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminGroupsComponent } from './admin-groups.component';

@Component({
  selector: 'cas-admin-groups-detail',
  template: '',
  standalone: false,
})
class GroupsDetailStub {
  @Input() groupId: string;
  @Input() canEdit: boolean;
}

const groups: Group[] = [
  { id: 'g1', name: 'Blue Team' },
  { id: 'g2', name: 'Red Team' },
];

async function renderGroups(grants: PermissionGrants, confirmAnswer?: boolean) {
  const groupsApi = {
    getAllGroups: vi.fn(() => of<Group[]>(structuredClone(groups))),
    deleteGroup: vi.fn((_id: string) => of<unknown>(null)),
  } satisfies ApiStub<GroupsService>;
  const usersApi = {
    getAllUsers: vi.fn(() => of<User[]>([])),
  } satisfies ApiStub<UsersService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(AdminGroupsComponent, {
    declarations: [GroupsDetailStub],
    imports: [
      MatTableModule,
      MatSortModule,
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatDialogModule,
    ],
    providers: [
      ...permissionDataProviders(grants),
      { provide: GroupsService, useValue: groupsApi },
      { provide: UsersService, useValue: usersApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
  });
  return { ...view, groupsApi, confirm, user: userEvent.setup() };
}

function rowOf(name: string) {
  return screen.getByRole('cell', { name }).closest('tr') as HTMLElement;
}

/** Near miss for ManageGroups: another group-related system permission. */
const viewGroupsOnly: PermissionGrants = {
  system: [SystemPermission.ViewGroups],
};

describe('AdminGroupsComponent', () => {
  /**
   * Verifies: ManageGroups enables Add New Group, Delete and Rename on every row.
   * Interacts with: PermissionService.hasPermission and canEditGroup (real), GroupsService.getAllGroups (stub).
   * Data: system permission ManageGroups; groups Blue Team and Red Team.
   */
  it('enables Add, Delete and Rename with ManageGroups', async () => {
    await renderGroups({ system: [SystemPermission.ManageGroups] });

    expect(screen.getByRole('button', { name: 'Add New Group' })).toBeEnabled();
    const row = rowOf('Blue Team');
    expect(
      within(row).getByRole('button', { name: 'Delete Blue Team' }),
    ).toBeEnabled();
    expect(within(row).getByRole('button', { name: 'Rename' })).toBeEnabled();
  });

  /**
   * Verifies: without ManageGroups, Add New Group and Delete are disabled, and Rename is disabled where the user has no EditGroup claim.
   * Interacts with: PermissionService.hasPermission and canEditGroup (real).
   * Data: near miss: system permission ViewGroups only, no group claims.
   */
  it('disables Add, Delete and Rename without ManageGroups', async () => {
    await renderGroups(viewGroupsOnly);

    expect(
      screen.getByRole('button', { name: 'Add New Group' }),
    ).toBeDisabled();
    const row = rowOf('Blue Team');
    expect(
      within(row).getByRole('button', { name: 'Delete Blue Team' }),
    ).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  /**
   * Verifies: an EditGroup claim enables Rename only on that group, while Delete stays disabled.
   * Interacts with: PermissionService.canEditGroup (real), GroupPermissionsService (stub).
   * Data: near miss for Red Team: an EditGroup claim on g1 only, and ManageMembership on g2.
   */
  it('enables Rename only on the group with an EditGroup claim', async () => {
    await renderGroups({
      groups: [
        { groupId: 'g1', permissions: [GroupPermission.EditGroup] },
        { groupId: 'g2', permissions: [GroupPermission.ManageMembership] },
      ],
    });

    const blue = rowOf('Blue Team');
    const red = rowOf('Red Team');
    expect(within(blue).getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(
      within(blue).getByRole('button', { name: 'Delete Blue Team' }),
    ).toBeDisabled();
    expect(within(red).getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  /**
   * Verifies: expanding a group passes canEdit true to its detail when the user has a ManageMembership claim on it.
   * Interacts with: PermissionService.canManageGroup (real), the detail stub's canEdit input.
   * Data: a ManageMembership claim on g1; the Blue Team row clicked.
   */
  it('lets a membership manager edit the expanded group', async () => {
    const { fixture, user } = await renderGroups({
      groups: [
        { groupId: 'g1', permissions: [GroupPermission.ManageMembership] },
      ],
    });

    await user.click(screen.getByRole('cell', { name: 'Blue Team' }));

    const detail: GroupsDetailStub = fixture.debugElement.query(
      By.directive(GroupsDetailStub),
    ).componentInstance;
    expect(detail.groupId).toBe('g1');
    expect(detail.canEdit).toBe(true);
  });

  /**
   * Verifies: expanding a group passes canEdit false to its detail without ManageGroups or a ManageMembership claim on that group.
   * Interacts with: PermissionService.canManageGroup (real), the detail stub's canEdit input.
   * Data: near miss: an EditGroup claim on g1 and a ManageMembership claim on g2; the Blue Team row clicked.
   */
  it('keeps the expanded group read-only without a ManageMembership claim on it', async () => {
    const { fixture, user } = await renderGroups({
      groups: [
        { groupId: 'g1', permissions: [GroupPermission.EditGroup] },
        { groupId: 'g2', permissions: [GroupPermission.ManageMembership] },
      ],
    });

    await user.click(screen.getByRole('cell', { name: 'Blue Team' }));

    const detail: GroupsDetailStub = fixture.debugElement.query(
      By.directive(GroupsDetailStub),
    ).componentInstance;
    expect(detail.canEdit).toBe(false);
  });

  /**
   * Verifies: confirming Delete calls the API and drops the group from the table.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), GroupsService.deleteGroup (stub), real GroupService.
   * Data: system permission ManageGroups; Red Team deleted.
   */
  it('deletes a group after confirmation', async () => {
    const { groupsApi, confirm, user } = await renderGroups(
      { system: [SystemPermission.ManageGroups] },
      true,
    );

    await user.click(screen.getByRole('button', { name: 'Delete Red Team' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(groupsApi.deleteGroup).toHaveBeenCalledWith('g2');
    expect(
      screen.queryByRole('cell', { name: 'Red Team' }),
    ).not.toBeInTheDocument();
  });
});
