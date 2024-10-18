// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { ComnAuthService, Theme } from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User, UsersService } from '../../generated/caster-api';
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

  editUser(user: User) {
    this.usersService
      .editUser(user.id, user)
      .pipe(
        tap((u) => {
          this.userStore.add(u);
          this.userStore.ui.upsert(u.id, this.userQuery.ui.getEntity(u.id));
        })
      )
      .subscribe();
  }

  setCurrentUser() {
    const currentUser = {
      name: '',
      id: '',
    };
    this.currentUserStore.update(currentUser);
    this.authService.user$.subscribe((user) => {
      if (!!user) {
        currentUser.name = user.profile.name;
        currentUser.id = user.profile.sub;
        this.currentUserStore.update(currentUser);
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
