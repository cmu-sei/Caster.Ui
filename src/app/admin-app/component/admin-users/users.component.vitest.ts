// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { User } from 'src/app/generated/caster-api';
import { UserService } from 'src/app/users/state/user.service';
import { UserQuery } from 'src/app/users/state/user.query';
import { PermissionService } from 'src/app/permissions/permission.service';
import { UsersComponent } from './users.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderUsers() {
  const load = vi.fn(() => of([]));
  const create = vi.fn(() => of({}));
  const deleteUser = vi.fn(() => of({}));

  const rendered = await renderComponent(UsersComponent, {
    declarations: [UsersComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: UserService, useValue: { load, create, delete: deleteUser } },
      {
        provide: UserQuery,
        useValue: { selectAll: () => of([]), selectLoading: () => of(false) },
      },
      { provide: PermissionService, useValue: { hasPermission: () => of(false) } },
    ],
  });

  return { ...rendered, load, create, deleteUser };
}

describe('UsersComponent', () => {
  it('creates and loads users on init', async () => {
    const { fixture, load } = await renderUsers();
    expect(fixture.componentInstance).toBeTruthy();
    expect(load).toHaveBeenCalled();
  });

  it('create() dispatches to UserService.create', async () => {
    const { fixture, create } = await renderUsers();
    const u: User = { id: 'u1', name: 'Alice' } as User;
    fixture.componentInstance.create(u);
    expect(create).toHaveBeenCalledWith(u);
  });

  it('deleteUser() dispatches to UserService.delete', async () => {
    const { fixture, deleteUser } = await renderUsers();
    fixture.componentInstance.deleteUser('u1');
    expect(deleteUser).toHaveBeenCalledWith('u1');
  });
});
