// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import {
  CreateGroupMembershipCommand,
  GroupMembership,
  User,
} from 'src/app/generated/caster-api';
import { GroupMembershipService } from 'src/app/groups/group-membership.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { UserQuery } from 'src/app/users/state';
import { AdminGroupsDetailComponent } from './admin-groups-detail.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const users: User[] = [
  { id: 'u1', name: 'Alice' } as User,
  { id: 'u2', name: 'Bob' } as User,
  { id: 'u3', name: 'Carol' } as User,
];

async function renderDetail(
  overrides: {
    groupId?: string;
    memberships?: GroupMembership[];
  } = {},
) {
  const { groupId = 'g1', memberships = [{ id: 'm1', groupId: 'g1', userId: 'u1' }] } =
    overrides;

  const memberships$ = new BehaviorSubject<GroupMembership[]>(memberships);
  const loadMemberships = vi.fn(() => of(memberships));
  const selectMemberships = vi.fn(() => memberships$.asObservable());
  const createMembership = vi.fn(() => of({}));
  const deleteMembership = vi.fn(() => of({}));

  const startConnection = vi.fn(() => Promise.resolve());
  const joinGroup = vi.fn();
  const leaveGroup = vi.fn();

  const rendered = await renderComponent(AdminGroupsDetailComponent, {
    declarations: [AdminGroupsDetailComponent],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { groupId, canEdit: true },
    providers: [
      {
        provide: GroupMembershipService,
        useValue: {
          loadMemberships,
          selectMemberships,
          createMembership,
          deleteMembership,
        },
      },
      {
        provide: SignalRService,
        useValue: { startConnection, joinGroup, leaveGroup },
      },
      {
        provide: UserQuery,
        useValue: { selectAll: () => of(users) },
      },
    ],
  });

  return {
    ...rendered,
    loadMemberships,
    selectMemberships,
    createMembership,
    deleteMembership,
    startConnection,
    joinGroup,
    leaveGroup,
  };
}

describe('AdminGroupsDetailComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderDetail();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads memberships and joins the signalR group on init', async () => {
    const { loadMemberships, startConnection } = await renderDetail();
    expect(loadMemberships).toHaveBeenCalledWith('g1');
    expect(startConnection).toHaveBeenCalled();
    // joinGroup is called inside the .then(); flush a microtask.
    await Promise.resolve();
  });

  it('ngOnDestroy leaves the signalR group', async () => {
    const { fixture, leaveGroup } = await renderDetail();
    fixture.componentInstance.ngOnDestroy();
    expect(leaveGroup).toHaveBeenCalledWith('g1');
  });

  it('members$ lists only users who have a membership', async () => {
    const { fixture } = await renderDetail({
      memberships: [{ id: 'm1', groupId: 'g1', userId: 'u1' }],
    });
    fixture.componentInstance.ngOnChanges();
    const members = await firstValueFrom(fixture.componentInstance.members$);
    expect(members.map((u) => u.id)).toEqual(['u1']);
  });

  it('nonMembers$ lists only users who are not yet members', async () => {
    const { fixture } = await renderDetail({
      memberships: [{ id: 'm1', groupId: 'g1', userId: 'u1' }],
    });
    fixture.componentInstance.ngOnChanges();
    const nonMembers = await firstValueFrom(fixture.componentInstance.nonMembers$);
    expect(nonMembers.map((u) => u.id)).toEqual(['u2', 'u3']);
  });

  it('createMembership dispatches to the service with the group id', async () => {
    const { fixture, createMembership } = await renderDetail();
    const cmd: CreateGroupMembershipCommand = { userId: 'u2' } as never;
    fixture.componentInstance.createMembership(cmd);
    expect(createMembership).toHaveBeenCalledWith('g1', cmd);
  });

  it('deleteMembership dispatches to the service with the id', async () => {
    const { fixture, deleteMembership } = await renderDetail();
    fixture.componentInstance.deleteMembership('m1');
    expect(deleteMembership).toHaveBeenCalledWith('m1');
  });
});
