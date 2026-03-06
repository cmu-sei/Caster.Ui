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
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ClipboardModule } from 'ngx-clipboard';
import { ProjectMembershipListComponent } from './project-membership-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const sharedImports = [
  FormsModule,
  MatTableModule,
  MatSortModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatInputModule,
  MatIconModule,
  MatButtonModule,
  MatPaginatorModule,
  MatSnackBarModule,
  ClipboardModule,
];

describe('ProjectMembershipListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(
      ProjectMembershipListComponent,
      {
        declarations: [ProjectMembershipListComponent],
        imports: sharedImports,
        componentProperties: {
          users: [],
          groups: [],
          canEdit: false,
        },
      }
    );
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Users/Groups heading', async () => {
    await renderComponent(ProjectMembershipListComponent, {
      declarations: [ProjectMembershipListComponent],
      imports: sharedImports,
      componentProperties: {
        users: [],
        groups: [],
        canEdit: false,
      },
    });

    expect(screen.getByText('Users/Groups')).toBeInTheDocument();
  });

  it('should show actions column when canEdit is true', async () => {
    const { fixture } = await renderComponent(
      ProjectMembershipListComponent,
      {
        declarations: [ProjectMembershipListComponent],
        imports: sharedImports,
        componentProperties: {
          users: [],
          groups: [],
          canEdit: true,
        },
      }
    );

    expect(fixture.componentInstance.displayedColumns).toContain('actions');
  });

  it('should not show actions column when canEdit is false', async () => {
    const { fixture } = await renderComponent(
      ProjectMembershipListComponent,
      {
        declarations: [ProjectMembershipListComponent],
        imports: sharedImports,
        componentProperties: {
          users: [],
          groups: [],
          canEdit: false,
        },
      }
    );

    expect(fixture.componentInstance.displayedColumns).not.toContain('actions');
  });

  it('should display user data', async () => {
    const users = [{ id: 'u-1', name: 'Bob' }];

    await renderComponent(ProjectMembershipListComponent, {
      declarations: [ProjectMembershipListComponent],
      imports: sharedImports,
      componentProperties: {
        users: users as any,
        groups: [],
        canEdit: false,
      },
    });

    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should display group data', async () => {
    const groups = [{ id: 'g-1', name: 'Team Alpha' }];

    await renderComponent(ProjectMembershipListComponent, {
      declarations: [ProjectMembershipListComponent],
      imports: sharedImports,
      componentProperties: {
        users: [],
        groups: groups as any,
        canEdit: false,
      },
    });

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
  });
});
