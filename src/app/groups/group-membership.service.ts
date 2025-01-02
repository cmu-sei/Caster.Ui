// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  CreateGroupMembershipCommand,
  GroupMembership,
  GroupsService,
} from '../generated/caster-api';

@Injectable({
  providedIn: 'root',
})
export class GroupMembershipService {
  private groupMembershipSubject = new BehaviorSubject<GroupMembership[]>([]);
  groupMemberships$ = this.groupMembershipSubject.asObservable();

  constructor(private groupService: GroupsService) {}

  selectMemberships(groupId: string): Observable<GroupMembership[]> {
    return this.groupMembershipSubject
      .asObservable()
      .pipe(map((x) => x.filter((y) => y.groupId == groupId)));
  }

  loadMemberships(groupId: string): Observable<GroupMembership[]> {
    return this.groupService.getGroupMemberships(groupId).pipe(
      tap((x) => {
        const memberships = this.groupMembershipSubject.getValue();

        x.forEach((y) => {
          const index = memberships.findIndex((m) => m.id === y.id);

          if (index !== -1) {
            memberships[index] = y;
          } else {
            memberships.push(y);
          }
        });

        this.groupMembershipSubject.next(memberships);
      })
    );
  }

  createMembership(groupId: string, command: CreateGroupMembershipCommand) {
    return this.groupService.createGroupMembership(groupId, command).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  deleteMembership(id: string) {
    return this.groupService.deleteGroupMembership(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  upsert(id: string, groupMembership: Partial<GroupMembership>) {
    const memberships = this.groupMembershipSubject.getValue();
    let membershipToUpdate = memberships.find((x) => x.id === id);

    if (membershipToUpdate != null) {
      Object.assign(membershipToUpdate, groupMembership);
    } else {
      memberships.push({ ...groupMembership, id } as GroupMembership);
    }

    this.groupMembershipSubject.next(memberships);
  }

  remove(id: string) {
    let memberships = this.groupMembershipSubject.getValue();
    memberships = memberships.filter((x) => x.id != id);
    this.groupMembershipSubject.next(memberships);
  }
}
