// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  GroupMembership,
  GroupMembershipRole,
  User,
} from 'src/app/generated/caster-api';
import { CurrentUserBadgeComponent } from 'src/app/shared/components/current-user-badge/current-user-badge.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CurrentUserStore } from 'src/app/users/state/user.store';
import { AdminGroupsMemberListComponent } from './admin-groups-member-list.component';

const users: User[] = [
  { id: 'u1', name: 'Ada' },
  { id: 'u2', name: 'Grace' },
];
const memberships: GroupMembership[] = [
  { id: 'm1', groupId: 'g1', userId: 'u1', role: GroupMembershipRole.Manager },
  { id: 'm2', groupId: 'g1', userId: 'u2', role: GroupMembershipRole.Member },
];

async function renderMemberList(canEdit: boolean, confirmAnswer?: boolean) {
  const deleteMembership =
    vi.fn<(e: { id: string; isCurrentUser: boolean }) => void>();
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(AdminGroupsMemberListComponent, {
    imports: [
      MatToolbarModule,
      MatFormFieldModule,
      MatInputModule,
      MatPaginatorModule,
      MatTableModule,
      MatSortModule,
      MatSelectModule,
      MatButtonModule,
      MatIconModule,
      CurrentUserBadgeComponent,
    ],
    providers: [
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { memberships, users, canEdit },
    on: { deleteMembership },
  });
  TestBed.inject(CurrentUserStore).update({ id: 'u1', name: 'Ada' });
  view.fixture.detectChanges();
  return { ...view, deleteMembership, confirm, user: userEvent.setup() };
}

describe('AdminGroupsMemberListComponent', () => {
  /**
   * Verifies: with canEdit, each member has a role select and an enabled Remove button, and removing another member emits deleteMembership without a confirmation.
   * Interacts with: the deleteMembership output, CrucibleDialogService.confirm (stub, not called).
   * Data: members Ada (current user, Manager) and Grace (Member); canEdit true.
   */
  it('removes another member directly when canEdit is true', async () => {
    const { deleteMembership, confirm, user } = await renderMemberList(true);
    const table = screen.getByRole('table');

    expect(within(table).getAllByRole('combobox')).toHaveLength(2);
    await user.click(
      within(table).getByRole('button', { name: 'Remove Grace' }),
    );

    expect(deleteMembership).toHaveBeenCalledWith({
      id: 'm2',
      isCurrentUser: false,
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  /**
   * Verifies: removing yourself asks for confirmation first and emits deleteMembership flagged as the current user once confirmed.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), the deleteMembership output, real CurrentUserQuery.
   * Data: current user u1 (Ada); canEdit true.
   */
  it('confirms before removing the current user', async () => {
    const { deleteMembership, confirm, user } = await renderMemberList(
      true,
      true,
    );

    await user.click(
      within(screen.getByRole('table')).getByRole('button', {
        name: 'Remove Ada',
      }),
    );

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(deleteMembership).toHaveBeenCalledWith({
      id: 'm1',
      isCurrentUser: true,
    });
  });

  /**
   * Verifies: without canEdit the members and their roles are shown read-only: no role select and no Remove button.
   * Interacts with: the displayedColumns built in ngOnChanges and the @if (canEdit) role cell.
   * Data: members Ada and Grace; canEdit false.
   */
  it('shows members read-only when canEdit is false', async () => {
    await renderMemberList(false);
    const table = screen.getByRole('table');

    expect(within(table).getByText('Grace')).toBeInTheDocument();
    expect(within(table).getByText('Manager')).toBeInTheDocument();
    expect(within(table).queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      within(table).queryByRole('button', { name: 'Remove Grace' }),
    ).not.toBeInTheDocument();
  });
});
