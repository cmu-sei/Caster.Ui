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
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { CreateProjectMembershipCommand } from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectMembershipListComponent } from './project-membership-list.component';

async function renderMembershipList(canEdit: boolean) {
  const createMembership = vi.fn<(c: CreateProjectMembershipCommand) => void>();
  const view = await renderComponent(ProjectMembershipListComponent, {
    imports: [
      MatToolbarModule,
      MatFormFieldModule,
      MatInputModule,
      MatPaginatorModule,
      MatTableModule,
      MatSortModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      ClipboardModule,
    ],
    inputs: {
      users: [{ id: 'u1', name: 'Ada' }],
      groups: [{ id: 'g1', name: 'Blue Team' }],
      canEdit,
    },
    on: { createMembership },
  });
  return { ...view, createMembership, user: userEvent.setup() };
}

describe('ProjectMembershipListComponent', () => {
  /**
   * Verifies: with canEdit, users and groups can be added, as a user membership and a group membership.
   * Interacts with: the createMembership output.
   * Data: user Ada and group Blue Team; canEdit true.
   */
  it('adds users and groups when canEdit is true', async () => {
    const { createMembership, user } = await renderMembershipList(true);
    const table = screen.getByRole('table');

    await user.click(within(table).getByRole('button', { name: 'Add Ada' }));
    await user.click(
      within(table).getByRole('button', { name: 'Add Blue Team' }),
    );

    expect(createMembership.mock.calls).toEqual([
      [{ userId: 'u1' }],
      [{ groupId: 'g1' }],
    ]);
  });

  /**
   * Verifies: without canEdit the Add column is left out, while users and groups are still listed.
   * Interacts with: the displayedColumns built in ngOnChanges.
   * Data: user Ada and group Blue Team; canEdit false.
   */
  it('hides the Add buttons when canEdit is false', async () => {
    await renderMembershipList(false);
    const table = screen.getByRole('table');

    expect(within(table).getByText('Blue Team')).toBeInTheDocument();
    expect(
      within(table).queryByRole('button', { name: 'Add Ada' }),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByRole('button', { name: 'Add Blue Team' }),
    ).not.toBeInTheDocument();
  });
});
