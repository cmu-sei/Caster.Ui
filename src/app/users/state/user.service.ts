// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { ComnAuthService, Theme } from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  PermissionsService,
  User,
  UserPermissionsService,
  UsersService,
} from '../../generated/caster-api';
import { UserQuery } from './user.query';
import { CurrentUserStore, UserStore } from './user.store';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private userStore: UserStore,
    private currentUserStore: CurrentUserStore,
    private userQuery: UserQuery,
    private usersService: UsersService,
    private userPermissionService: UserPermissionsService,
    private permissionService: PermissionsService,
    private authService: ComnAuthService
  ) {}

  load(): Observable<User[]> {
    this.userStore.setLoading(true);
    return this.usersService.getAllUsers().pipe(
      tap((users: User[]) => {
        this.userStore.set(users);
      }),
      tap(() => {
        this.userStore.setLoading(false);
      })
    );
  }

  loadById(id: string): Observable<User> {
    this.userStore.setLoading(true);
    return this.usersService.getUser(id).pipe(
      tap((_user: User) => {
        this.userStore.upsert(_user.id, { ..._user });
      }),
      tap(() => {
        this.userStore.setLoading(false);
      })
    );
  }

  create(user: User): Observable<User> {
    return this.usersService.createUser(user).pipe(
      tap((u) => {
        this.userStore.add(u);
        this.userStore.ui.upsert(u.id, this.userQuery.ui.getEntity(u.id));
      })
    );
  }

  delete(userId: string): Observable<any> {
    return this.usersService.deleteUser(userId).pipe(
      tap(() => {
        this.userStore.remove(userId);
        this.userStore.ui.remove(userId);
      })
    );
  }

  addUserPermission(userId: string, permissionId: string) {
    this.userPermissionService
      .createUserPermission({ userId, permissionId })
      .subscribe((up) => {
        this.loadById(userId).subscribe();
      });
  }

  removeUserPermission(userId: string, permissionId: string) {
    this.userPermissionService
      .deleteUserPermissionByIds(userId, permissionId)
      .subscribe((up) => {
        this.loadById(userId).subscribe();
      });
  }

  setCurrentUser() {
    const currentUser = {
      name: '',
      isSuperUser: false,
      id: '',
    };
    this.currentUserStore.update(currentUser);
    this.authService.user$.subscribe((user) => {
      if (!!user) {
        currentUser.name = user.profile.name;
        currentUser.id = user.profile.sub;
        this.currentUserStore.update(currentUser);
        this.permissionService.getMyPermissions().subscribe((permissions) => {
          currentUser.isSuperUser = permissions.some((permission) => {
            return permission.key === 'SystemAdmin';
          });
          this.currentUserStore.update(currentUser);
        });
      }
    });
  }

  setUserTheme(theme: Theme) {
    this.currentUserStore.update({ theme });
  }

  setActive(id) {
    this.userStore.setActive(id);
    this.userStore.ui.setActive(id);
  }
}
