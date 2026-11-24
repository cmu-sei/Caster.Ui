// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CurrentUserQuery } from 'src/app/users/state';

/** A user with a project open, as ProjectHub sends them. */
export interface PresentUser {
  id: string;
  name: string;
}

/** Everyone with a project open as of a version, as ProjectHub sends it. Versions only increase. */
export interface PresenceState {
  projectId: string;
  version: number;
  users: PresentUser[];
}

/**
 * The other users with the open project open. The hub sends the whole list each time it changes, with a
 * version, and answers JoinProject with the current one. SignalR can deliver those in any order, so a
 * list is applied only when it is for the open project and newer than the last one applied. The list
 * holds each user once, and never the current user.
 */
@Injectable({
  providedIn: 'root',
})
export class ProjectPresenceService {
  private presentUsersSubject = new BehaviorSubject<PresentUser[]>([]);
  public presentUsers$ = this.presentUsersSubject.asObservable();

  private currentUserQuery = inject(CurrentUserQuery);

  private version = -1;

  /** Shows `state`, unless it is for another project than `openProjectId` or no newer than what is shown. */
  apply(state: PresenceState, openProjectId: string | null) {
    // An older API answers JoinProject with nothing.
    if (!state) {
      return;
    }

    if (state.projectId !== openProjectId || state.version <= this.version) {
      return;
    }

    this.version = state.version;
    this.presentUsersSubject.next(
      this.sort(this.withoutMe(this.distinct(state.users ?? []))),
    );
  }

  clear() {
    this.version = -1;

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
