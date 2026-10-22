// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  SystemPermission,
  User,
  UsersService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UsersComponent } from './users.component';

@Component({ selector: 'cas-user-list', template: '', standalone: false })
class UserListStub {
  @Input() users: User[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() create = new EventEmitter<User>();
  @Output() delete = new EventEmitter<string>();
}

async function renderUsers(grants: PermissionGrants) {
  const usersApi = {
    getAllUsers: vi.fn(() => of<User[]>([{ id: 'u1', name: 'Ada' }])),
    deleteUser: vi.fn((_id: string) => of<unknown>(null)),
  } satisfies ApiStub<UsersService>;
  const view = await renderComponent(UsersComponent, {
    declarations: [UserListStub],
    providers: [
      ...permissionDataProviders(grants),
      { provide: UsersService, useValue: usersApi },
    ],
  });
  const list: UserListStub = view.fixture.debugElement.query(
    By.directive(UserListStub),
  ).componentInstance;
  return { ...view, list, usersApi };
}

describe('UsersComponent', () => {
  /**
   * Verifies: the page loads the users into the list and clears loading.
   * Interacts with: UsersService.getAllUsers (stub), real UserService and UserQuery.
   * Data: one user u1.
   */
  it('loads the users into the list', async () => {
    const { list } = await renderUsers({});

    expect(list.users.map((u) => u.id)).toEqual(['u1']);
    expect(list.isLoading).toBe(false);
  });

  /**
   * Verifies: ManageUsers makes the user list editable.
   * Interacts with: PermissionService.hasPermission (real), the list stub's canEdit input.
   * Data: system permission ManageUsers.
   */
  it('passes canEdit true with ManageUsers', async () => {
    const { list } = await renderUsers({
      system: [SystemPermission.ManageUsers],
    });

    expect(list.canEdit).toBe(true);
  });

  /**
   * Verifies: without ManageUsers the user list is read-only.
   * Interacts with: PermissionService.hasPermission (real), the list stub's canEdit input.
   * Data: near miss: system permission ViewUsers only.
   */
  it('passes canEdit false without ManageUsers', async () => {
    const { list } = await renderUsers({
      system: [SystemPermission.ViewUsers],
    });

    expect(list.canEdit).toBe(false);
  });

  /**
   * Verifies: a delete from the list deletes the user through the API and drops it from the list.
   * Interacts with: the list stub's delete output, UsersService.deleteUser (stub), real UserService and UserQuery.
   * Data: system permission ManageUsers; user u1 deleted.
   */
  it('deletes the user the list emits', async () => {
    const { fixture, list, usersApi } = await renderUsers({
      system: [SystemPermission.ManageUsers],
    });

    list.delete.emit('u1');
    fixture.detectChanges();

    expect(usersApi.deleteUser).toHaveBeenCalledWith('u1');
    expect(list.users).toEqual([]);
  });
});
