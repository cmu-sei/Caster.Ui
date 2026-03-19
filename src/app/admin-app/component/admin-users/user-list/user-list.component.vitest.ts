// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { UserListComponent } from './user-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { User } from 'src/app/generated/caster-api';
import { RoleService } from 'src/app/roles/roles.service.service';
import { of } from 'rxjs';

const mockUsers: User[] = [
  { id: 'u1-guid-0001', name: 'Alice Smith', roleId: null },
  { id: 'u2-guid-0002', name: 'Bob Jones', roleId: null },
  { id: 'u3-guid-0003', name: 'Charlie Brown', roleId: null },
];

function userDataSource(users: User[]): MatTableDataSource<User> {
  return new MatTableDataSource(users);
}

const sharedImports = [
  FormsModule,
  MatTableModule,
  MatSortModule,
  MatPaginatorModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,
  MatTooltipModule,
  MatIconModule,
  MatProgressSpinnerModule,
  MatDialogModule,
  MatSelectModule,
  ClipboardModule,
];

async function renderUserList(
  overrides: {
    users?: User[];
    isLoading?: boolean;
    canEdit?: boolean;
    dataSource?: MatTableDataSource<User>;
  } = {}
) {
  return renderComponent(UserListComponent, {
    declarations: [UserListComponent],
    imports: sharedImports,
    providers: [
      {
        provide: RoleService,
        useValue: {
          roles$: of([]),
          getRoles: () => of([]),
        },
      },
    ],
    componentProperties: {
      users: overrides.users ?? [],
      isLoading: overrides.isLoading ?? false,
      canEdit: overrides.canEdit ?? false,
      ...(overrides.dataSource ? { dataSource: overrides.dataSource } : {}),
    } as any,
  });
}

describe('UserListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderUserList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display users in table', async () => {
    await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('should show Add User button when canEdit is true', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    expect(
      container.querySelector('button[title="Add User"]')
    ).toBeInTheDocument();
  });

  it('should disable Add User button when canEdit is false', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    const btn = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('should show add user form when Add button clicked', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);

    expect(
      container.querySelector('input[placeholder="User ID"]')
    ).toBeVisible();
    expect(
      container.querySelector('input[placeholder="User Name"]')
    ).toBeVisible();
  });

  it('should disable submit when name is too short', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);

    const idInput = container.querySelector(
      'input[placeholder="User ID"]'
    ) as HTMLInputElement;
    const nameInput = container.querySelector(
      'input[placeholder="User Name"]'
    ) as HTMLInputElement;
    await userEvent.type(idInput, '12345678-1234-1234-1234-123456789abc');
    await userEvent.type(nameInput, 'Ab');

    const submitIcon = container.querySelector(
      'mat-icon[matTooltip="Add this user"]'
    );
    const submitButton = submitIcon?.closest('button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('should enable submit when ID and name are valid', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);

    const idInput = container.querySelector(
      'input[placeholder="User ID"]'
    ) as HTMLInputElement;
    const nameInput = container.querySelector(
      'input[placeholder="User Name"]'
    ) as HTMLInputElement;
    await userEvent.type(idInput, '12345678-1234-1234-1234-123456789abc');
    await userEvent.type(nameInput, 'Valid Name');

    const submitIcon = container.querySelector(
      'mat-icon[matTooltip="Add this user"]'
    );
    const submitButton = submitIcon?.closest('button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it('should filter users by name when typing in search', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Alice');
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
  });

  it('should filter users by ID when typing in search', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'u2-guid');
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
  });

  it('should filter case-insensitively', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'charlie');
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('should show no rows when search has no match', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'zzz_no_match');
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
  });

  it('should clear search and restore all users when clear button clicked', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Alice');
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();

    const clearButton = container.querySelector(
      'button[aria-label="Clear"]'
    ) as HTMLButtonElement;
    await userEvent.click(clearButton);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('should show delete button per user when canEdit', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    expect(
      container.querySelectorAll('button[title="Delete User"]')
    ).toHaveLength(mockUsers.length);
  });

  it('should cancel add user form when cancel button clicked', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);
    expect(
      container.querySelector('input[placeholder="User ID"]')
    ).toBeVisible();

    const cancelButton = container.querySelector(
      'button[matTooltip="Cancel"]'
    ) as HTMLButtonElement;
    await userEvent.click(cancelButton);
    expect(container.querySelector('input[placeholder="User ID"]')).toBeNull();
  });

  it('should show loading spinner when isLoading is true', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: true,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    expect(container.querySelector('mat-progress-spinner')).toBeInTheDocument();
  });

  it('should not show loading spinner when isLoading is false', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    expect(container.querySelector('mat-progress-spinner')).toBeNull();
  });

  it('should display user IDs in table', async () => {
    await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    expect(screen.getByText('u1-guid-0001')).toBeInTheDocument();
    expect(screen.getByText('u2-guid-0002')).toBeInTheDocument();
    expect(screen.getByText('u3-guid-0003')).toBeInTheDocument();
  });

  it('should show role select dropdown for each user', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    expect(container.querySelectorAll('table mat-select')).toHaveLength(
      mockUsers.length
    );
  });

  it('should disable submit when only ID is filled', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);

    const idInput = container.querySelector(
      'input[placeholder="User ID"]'
    ) as HTMLInputElement;
    await userEvent.type(idInput, '12345678-1234-1234-1234-123456789abc');

    const submitIcon = container.querySelector(
      'mat-icon[matTooltip="Add this user"]'
    );
    const submitButton = submitIcon?.closest('button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('should disable submit when only name is filled', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);

    const nameInput = container.querySelector(
      'input[placeholder="User Name"]'
    ) as HTMLInputElement;
    await userEvent.type(nameInput, 'Valid Name');

    const submitIcon = container.querySelector(
      'mat-icon[matTooltip="Add this user"]'
    );
    const submitButton = submitIcon?.closest('button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('should disable submit when name is exactly 3 characters', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);

    const idInput = container.querySelector(
      'input[placeholder="User ID"]'
    ) as HTMLInputElement;
    const nameInput = container.querySelector(
      'input[placeholder="User Name"]'
    ) as HTMLInputElement;
    await userEvent.type(idInput, '12345678-1234-1234-1234-123456789abc');
    await userEvent.type(nameInput, 'Abc');

    const submitIcon = container.querySelector(
      'mat-icon[matTooltip="Add this user"]'
    );
    const submitButton = submitIcon?.closest('button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('should enable submit when name is exactly 4 characters', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: true,
      dataSource: userDataSource(mockUsers),
    });

    const addButton = container.querySelector(
      'button[title="Add User"]'
    ) as HTMLButtonElement;
    await userEvent.click(addButton);

    const idInput = container.querySelector(
      'input[placeholder="User ID"]'
    ) as HTMLInputElement;
    const nameInput = container.querySelector(
      'input[placeholder="User Name"]'
    ) as HTMLInputElement;
    await userEvent.type(idInput, '12345678-1234-1234-1234-123456789abc');
    await userEvent.type(nameInput, 'Abcd');

    const submitIcon = container.querySelector(
      'mat-icon[matTooltip="Add this user"]'
    );
    const submitButton = submitIcon?.closest('button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it('should show copy ID button per user', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    expect(container.querySelectorAll('button[title^="Copy:"]')).toHaveLength(
      mockUsers.length
    );
  });

  it('should hide delete buttons when canEdit is false', async () => {
    const { container } = await renderUserList({
      users: mockUsers,
      isLoading: false,
      canEdit: false,
      dataSource: userDataSource(mockUsers),
    });

    expect(container.querySelector('button[title="Delete User"]')).toBeNull();
  });
});
