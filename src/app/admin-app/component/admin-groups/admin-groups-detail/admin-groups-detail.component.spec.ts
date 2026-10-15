// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  CreateGroupMembershipCommand,
  GroupMembership,
  GroupMembershipRole,
  GroupsService,
  User,
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { UserStore } from 'src/app/users/state/user.store';
import { AdminGroupsDetailComponent } from './admin-groups-detail.component';

@Component({
  selector: 'cas-admin-groups-membership-list',
  template: '',
  standalone: false,
})
class MembershipListStub {
  @Input() users: User[];
  @Input() canEdit: boolean;
  @Output() createMembership = new EventEmitter<CreateGroupMembershipCommand>();
}

@Component({
  selector: 'cas-admin-groups-member-list',
  template: '',
  standalone: false,
})
class MemberListStub {
  @Input() memberships: GroupMembership[];
  @Input() users: User[];
  @Input() canEdit: boolean;
  @Output() deleteMembership = new EventEmitter<{
    id: string;
    isCurrentUser: boolean;
  }>();
  @Output() changeRole = new EventEmitter<{
    id: string;
    role: GroupMembershipRole;
    isCurrentUser: boolean;
  }>();
}

const users: User[] = [
  { id: 'u1', name: 'Ada' },
  { id: 'u2', name: 'Grace' },
];

async function renderDetail(canEdit: boolean) {
  const groupsApi = {
    getGroupMemberships: vi.fn((groupId: string) =>
      of<GroupMembership[]>([
        { id: 'm1', groupId, userId: 'u1', role: GroupMembershipRole.Member },
      ]),
    ),
  } satisfies ApiStub<GroupsService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'joinGroup' | 'leaveGroup'
  >;
  const view = await renderComponent(AdminGroupsDetailComponent, {
    declarations: [MembershipListStub, MemberListStub],
    providers: [
      { provide: GroupsService, useValue: groupsApi },
      { provide: SignalRService, useValue: signalR },
    ],
    inputs: { groupId: 'g1', canEdit },
  });
  TestBed.inject(UserStore).set(users);
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  const stub = <T>(type: Type<T>): T =>
    view.fixture.debugElement.query(By.directive(type)).componentInstance;
  return { ...view, groupsApi, signalR, stub };
}

describe('AdminGroupsDetailComponent', () => {
  /**
   * Verifies: the detail loads the group's memberships, joins the group's hub group, and splits users into members and non-members.
   * Interacts with: GroupsService.getGroupMemberships (stub), real GroupMembershipService and UserQuery, SignalRService (stub).
   * Data: group g1 with member u1; users u1 and u2; canEdit true.
   */
  it('passes members and non-members to the lists', async () => {
    const { groupsApi, signalR, stub } = await renderDetail(true);

    expect(groupsApi.getGroupMemberships).toHaveBeenCalledWith('g1');
    expect(signalR.joinGroup).toHaveBeenCalledWith('g1');
    expect(stub(MemberListStub).users).toEqual([users[0]]);
    expect(stub(MembershipListStub).users).toEqual([users[1]]);
  });

  /**
   * Verifies: a true canEdit input reaches both lists.
   * Interacts with: the canEdit inputs of the membership list and member list stubs.
   * Data: canEdit true.
   */
  it('passes canEdit true to both lists', async () => {
    const { stub } = await renderDetail(true);

    expect(stub(MembershipListStub).canEdit).toBe(true);
    expect(stub(MemberListStub).canEdit).toBe(true);
  });

  /**
   * Verifies: a false canEdit input reaches both lists, so neither offers editing controls.
   * Interacts with: the canEdit inputs of the membership list and member list stubs.
   * Data: canEdit false.
   */
  it('passes canEdit false to both lists when the user cannot manage the group', async () => {
    const { stub } = await renderDetail(false);

    expect(stub(MembershipListStub).canEdit).toBe(false);
    expect(stub(MemberListStub).canEdit).toBe(false);
  });
});
