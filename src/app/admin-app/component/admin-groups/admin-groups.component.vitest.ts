// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AdminGroupsComponent } from './admin-groups.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { Group, SystemPermission } from 'src/app/generated/caster-api';
import { GroupService } from 'src/app/groups/group.service';
import { PermissionService } from 'src/app/permissions/permission.service';

const mockGroups: Group[] = [
  { id: 'g1', name: 'Security Team' },
  { id: 'g2', name: 'Operations Group' },
  { id: 'g3', name: 'Development Squad' },
];

const sharedImports = [
  FormsModule,
  MatTableModule,
  MatSortModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,
  MatTooltipModule,
  MatIconModule,
  MatDialogModule,
];

function groupServiceProvider(groups: Group[]) {
  return {
    provide: GroupService,
    useValue: {
      groups$: of(groups),
      load: () => of(groups),
      create: () => of({}),
      edit: () => of({}),
      delete: () => of({}),
    },
  };
}

function permProvider(canEdit: boolean) {
  return {
    provide: PermissionService,
    useValue: {
      permissions$: of(canEdit ? [SystemPermission.ManageGroups] : []),
      projectPermissions$: of([]),
      load: () => of([]),
      loadProjectPermissions: () => of([]),
      canViewAdiminstration: () => of(true),
      hasPermission: (p: SystemPermission) =>
        of(canEdit && p === SystemPermission.ManageGroups),
      canEditProject: () => of(false),
      canManageProject: () => of(false),
      canAdminLockProject: () => of(false),
    },
  };
}

async function renderAdminGroups(groups: Group[] = [], canEdit = false) {
  return renderComponent(AdminGroupsComponent, {
    declarations: [AdminGroupsComponent],
    imports: sharedImports,
    providers: [groupServiceProvider(groups), permProvider(canEdit)],
  });
}

describe('AdminGroupsComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminGroups();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display group names', async () => {
    await renderAdminGroups(mockGroups, false);

    expect(screen.getByText('Security Team')).toBeInTheDocument();
    expect(screen.getByText('Operations Group')).toBeInTheDocument();
    expect(screen.getByText('Development Squad')).toBeInTheDocument();
  });

  it('should filter groups by name', async () => {
    const { container } = await renderAdminGroups(mockGroups, false);

    const input = container.querySelector(
      'input[placeholder="Search Groups"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Security');
    expect(screen.getByText('Security Team')).toBeInTheDocument();
    expect(screen.queryByText('Operations Group')).not.toBeInTheDocument();
    expect(screen.queryByText('Development Squad')).not.toBeInTheDocument();
  });

  it('should filter groups case-insensitively', async () => {
    const { container } = await renderAdminGroups(mockGroups, false);

    const input = container.querySelector(
      'input[placeholder="Search Groups"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'operations');
    expect(screen.getByText('Operations Group')).toBeInTheDocument();
    expect(screen.queryByText('Security Team')).not.toBeInTheDocument();
  });

  it('should filter groups by partial match', async () => {
    const { container } = await renderAdminGroups(mockGroups, false);

    const input = container.querySelector(
      'input[placeholder="Search Groups"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Squad');
    expect(screen.getByText('Development Squad')).toBeInTheDocument();
    expect(screen.queryByText('Security Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Operations Group')).not.toBeInTheDocument();
  });

  it('should show no rows when search has no match', async () => {
    const { container } = await renderAdminGroups(mockGroups, false);

    const input = container.querySelector(
      'input[placeholder="Search Groups"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'zzz_no_match');
    expect(screen.queryByText('Security Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Operations Group')).not.toBeInTheDocument();
    expect(screen.queryByText('Development Squad')).not.toBeInTheDocument();
  });

  it('should clear search and restore all groups', async () => {
    const { container } = await renderAdminGroups(mockGroups, false);

    const input = container.querySelector(
      'input[placeholder="Search Groups"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Security');
    expect(screen.queryByText('Operations Group')).not.toBeInTheDocument();

    const clearButton = container.querySelector(
      'button[aria-label="Clear"]'
    ) as HTMLButtonElement;
    await userEvent.click(clearButton);
    expect(screen.getByText('Security Team')).toBeInTheDocument();
    expect(screen.getByText('Operations Group')).toBeInTheDocument();
    expect(screen.getByText('Development Squad')).toBeInTheDocument();
  });

  it('should show Add New Group button when canEdit', async () => {
    const { container } = await renderAdminGroups(mockGroups, true);

    expect(
      container.querySelector('button[matTooltip="Add New Group"]')
    ).toBeInTheDocument();
  });

  it('should disable Add New Group button without permission', async () => {
    const { container } = await renderAdminGroups(mockGroups, false);

    const btn = container.querySelector(
      'button[matTooltip="Add New Group"]'
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('should show Group Name header', async () => {
    await renderAdminGroups(mockGroups, false);

    expect(screen.getByText('Group Name')).toBeInTheDocument();
  });

  it('should show delete and rename buttons per group when canEdit', async () => {
    const { container } = await renderAdminGroups(mockGroups, true);

    expect(
      container.querySelectorAll('button[matTooltip="Rename"]')
    ).toHaveLength(mockGroups.length);
  });

  it('should disable delete and rename buttons without permission', async () => {
    const { container } = await renderAdminGroups(mockGroups, false);

    const renameBtn = container.querySelector(
      'button[matTooltip="Rename"]'
    ) as HTMLButtonElement;
    expect(renameBtn).toBeTruthy();
    expect(renameBtn.disabled).toBe(true);
  });
});
