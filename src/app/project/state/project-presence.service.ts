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

  // Arrivals and departures heard while a JoinProject answer is on its way. SignalR can hand the
  // answer over after events that happened later than it, so the answer must not overwrite them.
  private heard: { token: symbol; events: (() => void)[] } | null = null;

  set(users: PresentUser[]) {
    this.presentUsersSubject.next(
      this.sort(this.withoutMe(this.distinct(users ?? []))),
    );
  }

  /**
   * Starts holding on to what the hub announces until the answer to JoinProject arrives.
   * @returns the token to give to {@link applySnapshot} or {@link endSnapshot}.
   */
  beginSnapshot(): symbol {
    const token = Symbol('presence snapshot');
    this.heard = { token, events: [] };
    return token;
  }

  /**
   * Sets who was present when the project was joined, then applies what was announced since, in order.
   * Does nothing when a later join has started.
   */
  applySnapshot(token: symbol, users: PresentUser[]) {
    if (this.heard?.token !== token) {
      return;
    }

    const events = this.heard.events;
    this.heard = null;
    this.set(users);
    events.forEach((replay) => replay());
  }

  /** Stops holding on to announcements, when the answer never came. */
  endSnapshot(token: symbol) {
    if (this.heard?.token === token) {
      this.heard = null;
    }
  }

  arrived(user: PresentUser) {
    this.heard?.events.push(() => this.arrived(user));
    const users = this.presentUsersSubject
      .getValue()
      .filter((x) => x.id !== user.id);
    this.set([...users, user]);
  }

  departed(user: PresentUser) {
    this.heard?.events.push(() => this.departed(user));
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
