// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ClipboardModule } from 'ngx-clipboard';
import {
  CreateGroupMembershipCommand,
  GroupMembershipRole,
  User,
} from 'src/app/generated/caster-api';
import { CurrentUserBadgeComponent } from 'src/app/shared/components/current-user-badge/current-user-badge.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminGroupsMembershipListComponent } from './admin-groups-membership-list.component';

const users: User[] = [
  { id: 'u1', name: 'Ada' },
  { id: 'u2', name: 'Grace' },
];

async function renderMembershipList(canEdit: boolean) {
  const createMembership = vi.fn<(c: CreateGroupMembershipCommand) => void>();
  const view = await renderComponent(AdminGroupsMembershipListComponent, {
    imports: [
      MatToolbarModule,
      MatFormFieldModule,
      MatInputModule,
      MatPaginatorModule,
      MatTableModule,
      MatSortModule,
      MatButtonModule,
      MatIconModule,
      ClipboardModule,
      CurrentUserBadgeComponent,
    ],
    inputs: { users, canEdit },
    on: { createMembership },
  });
  return { ...view, createMembership, user: userEvent.setup() };
}

describe('AdminGroupsMembershipListComponent', () => {
  /**
   * Verifies: with canEdit, every non-member has an Add button that emits a Member membership for that user.
   * Interacts with: the createMembership output.
   * Data: users Ada and Grace; canEdit true.
   */
  it('adds a user as a Member when canEdit is true', async () => {
    const { createMembership, user } = await renderMembershipList(true);
    const table = screen.getByRole('table');

    expect(
      within(table).getByRole('button', { name: 'Add Ada' }),
    ).toBeEnabled();
    await user.click(within(table).getByRole('button', { name: 'Add Grace' }));

    expect(createMembership).toHaveBeenCalledWith({
      userId: 'u2',
      role: GroupMembershipRole.Member,
    });
  });

  /**
   * Verifies: without canEdit the actions column is left out, so no Add button renders, while the users are still listed.
   * Interacts with: the displayedColumns built in ngOnChanges.
   * Data: users Ada and Grace; canEdit false.
   */
  it('hides the Add buttons when canEdit is false', async () => {
    await renderMembershipList(false);
    const table = screen.getByRole('table');

    expect(within(table).getByText('Ada')).toBeInTheDocument();
    expect(
      within(table).queryByRole('button', { name: 'Add Ada' }),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByRole('button', { name: 'Add Grace' }),
    ).not.toBeInTheDocument();
  });
});
