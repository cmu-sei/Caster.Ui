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
import { MatSelectModule } from '@angular/material/select';
import { MatSelectHarness } from '@angular/material/select/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  EditProjectMembershipCommand,
  ProjectMembership,
} from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectMemberListComponent } from './project-member-list.component';

const memberships: ProjectMembership[] = [
  { id: 'm1', projectId: 'p1', userId: 'u1', roleId: 'r1' },
  { id: 'm2', projectId: 'p1', groupId: 'g1', roleId: 'r2' },
];

async function renderMemberList(canEdit: boolean) {
  const deleteMembership = vi.fn<(id: string) => void>();
  const editMembership = vi.fn<(c: EditProjectMembershipCommand) => void>();
  const view = await renderComponent(ProjectMemberListComponent, {
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
      MatTooltipModule,
    ],
    inputs: {
      memberships,
      users: [{ id: 'u1', name: 'Ada' }],
      groups: [{ id: 'g1', name: 'Blue Team' }],
      roles: [
        { id: 'r1', name: 'Member' },
        { id: 'r2', name: 'Manager' },
      ],
      canEdit,
    },
    on: { deleteMembership, editMembership },
  });
  return { ...view, deleteMembership, editMembership, user: userEvent.setup() };
}

describe('ProjectMemberListComponent', () => {
  /**
   * Verifies: with canEdit a member's role can be changed and a member removed.
   * Interacts with: the editMembership and deleteMembership outputs.
   * Data: user Ada (Member) and group Blue Team (Manager); Ada made Manager, Blue Team removed; canEdit true.
   */
  it('edits and removes members when canEdit is true', async () => {
    const { fixture, editMembership, deleteMembership, user } =
      await renderMemberList(true);
    const table = screen.getByRole('table');
    // A mat-select outside a mat-form-field opens from its inner trigger, so
    // drive it through its harness.
    const [adaRole] = await TestbedHarnessEnvironment.loader(
      fixture,
    ).getAllHarnesses(MatSelectHarness.with({ ancestor: 'table' }));
    expect(await adaRole.getValueText()).toBe('Member');
    await adaRole.open();
    await adaRole.clickOptions({ text: 'Manager' });
    await user.click(
      within(table).getByRole('button', { name: 'Remove Blue Team' }),
    );

    expect(editMembership).toHaveBeenCalledWith({ id: 'm1', roleId: 'r2' });
    expect(deleteMembership).toHaveBeenCalledWith('m2');
  });

  /**
   * Verifies: without canEdit the role selects are disabled and the Remove column is left out.
   * Interacts with: the [disabled]="!canEdit" select binding and displayedColumns.
   * Data: user Ada and group Blue Team; canEdit false.
   */
  it('shows members read-only when canEdit is false', async () => {
    await renderMemberList(false);
    const table = screen.getByRole('table');

    for (const select of within(table).getAllByRole('combobox')) {
      expect(select).toHaveAttribute('aria-disabled', 'true');
    }
    expect(
      within(table).queryByRole('button', { name: 'Remove Ada' }),
    ).not.toBeInTheDocument();
  });
});
