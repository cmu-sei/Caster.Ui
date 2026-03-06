// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule } from '@angular/material/paginator';
import { ProjectMemberListComponent } from './project-member-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const sharedImports = [
  FormsModule,
  MatTableModule,
  MatSortModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatInputModule,
  MatSelectModule,
  MatIconModule,
  MatButtonModule,
  MatPaginatorModule,
];

describe('ProjectMemberListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ProjectMemberListComponent, {
      declarations: [ProjectMemberListComponent],
      imports: sharedImports,
      componentProperties: {
        memberships: [],
        users: [],
        groups: [],
        roles: [],
        canEdit: false,
      },
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Project Members heading', async () => {
    await renderComponent(ProjectMemberListComponent, {
      declarations: [ProjectMemberListComponent],
      imports: sharedImports,
      componentProperties: {
        memberships: [],
        users: [],
        groups: [],
        roles: [],
        canEdit: false,
      },
    });

    expect(screen.getByText('Project Members')).toBeInTheDocument();
  });

  it('should show empty message when no members', async () => {
    await renderComponent(ProjectMemberListComponent, {
      declarations: [ProjectMemberListComponent],
      imports: sharedImports,
      componentProperties: {
        memberships: [],
        users: [],
        groups: [],
        roles: [],
        canEdit: false,
      },
    });

    expect(
      screen.getByText('This Project currently has no members')
    ).toBeInTheDocument();
  });

  it('should show actions column when canEdit is true', async () => {
    const { fixture } = await renderComponent(ProjectMemberListComponent, {
      declarations: [ProjectMemberListComponent],
      imports: sharedImports,
      componentProperties: {
        memberships: [],
        users: [],
        groups: [],
        roles: [],
        canEdit: true,
      },
    });

    expect(fixture.componentInstance.displayedColumns).toContain('actions');
  });

  it('should not show actions column when canEdit is false', async () => {
    const { fixture } = await renderComponent(ProjectMemberListComponent, {
      declarations: [ProjectMemberListComponent],
      imports: sharedImports,
      componentProperties: {
        memberships: [],
        users: [],
        groups: [],
        roles: [],
        canEdit: false,
      },
    });

    expect(fixture.componentInstance.displayedColumns).not.toContain('actions');
  });

  it('should display member data', async () => {
    const role = { id: 'r-1', name: 'Editor' };
    const user = { id: 'u-1', name: 'Alice' };
    const membership = { id: 'm-1', userId: 'u-1', roleId: 'r-1' };

    await renderComponent(ProjectMemberListComponent, {
      declarations: [ProjectMemberListComponent],
      imports: sharedImports,
      componentProperties: {
        memberships: [membership] as any,
        users: [user] as any,
        groups: [],
        roles: [role] as any,
        canEdit: false,
      },
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
