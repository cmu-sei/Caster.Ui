// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AdminGroupsDetailComponent } from './admin-groups-detail.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { GroupMembershipService } from 'src/app/groups/group-membership.service';
import { of } from 'rxjs';

describe('AdminGroupsDetailComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(AdminGroupsDetailComponent, {
      declarations: [AdminGroupsDetailComponent],
      providers: [
        {
          provide: SignalRService,
          useValue: {
            startConnection: () => Promise.resolve(),
            joinGroup: () => {},
            leaveGroup: () => {},
            joinProject: () => {},
            leaveProject: () => {},
            joinWorkspace: () => {},
            leaveWorkspace: () => {},
          },
        },
        {
          provide: GroupMembershipService,
          useValue: {
            groupMemberships$: of([]),
            loadMemberships: () => of([]),
            selectMemberships: () => of([]),
            createMembership: () => of({}),
            deleteMembership: () => of(null),
          },
        },
      ],
      componentProperties: { groupId: 'test-group-id' },
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
