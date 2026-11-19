// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CurrentUserQuery } from 'src/app/users/state';

/** Another user with the open project open, as ProjectHub sends them. */
export interface PresentUser {
  id: string;
  name: string;
}

/**
 * The other users with the open project open: set from JoinProject's answer,
 * then kept by the hub's PresenceArrived and PresenceDeparted events. The hub
 * sends one arrival per user however many tabs they have, so this holds each
 * user once, and never the current user.
 */
@Injectable({
  providedIn: 'root',
})
export class ProjectPresenceService {
  private presentUsersSubject = new BehaviorSubject<PresentUser[]>([]);
  public presentUsers$ = this.presentUsersSubject.asObservable();

  private currentUserQuery = inject(CurrentUserQuery);

  set(users: PresentUser[]) {
    this.presentUsersSubject.next(
      this.sort(this.withoutMe(this.distinct(users ?? []))),
    );
  }

  arrived(user: PresentUser) {
    const users = this.presentUsersSubject
      .getValue()
      .filter((x) => x.id !== user.id);
    this.set([...users, user]);
  }

  departed(user: PresentUser) {
    const users = this.presentUsersSubject.getValue();

    if (users.some((x) => x.id === user.id)) {
      this.presentUsersSubject.next(users.filter((x) => x.id !== user.id));
    }
  }

  clear() {
    if (this.presentUsersSubject.getValue().length > 0) {
      this.presentUsersSubject.next([]);
    }
  }

  private distinct(users: PresentUser[]): PresentUser[] {
    return users.filter(
      (user, index) => users.findIndex((x) => x.id === user.id) === index,
    );
  }

  // Two tabs of one user opening at once can each hear the other arrive.
  private withoutMe(users: PresentUser[]): PresentUser[] {
    const me = this.currentUserQuery.getValue().id;
    return users.filter((x) => x.id !== me);
  }

  private sort(users: PresentUser[]): PresentUser[] {
    return [...users].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', undefined, {
        sensitivity: 'base',
      }),
    );
  }
}
