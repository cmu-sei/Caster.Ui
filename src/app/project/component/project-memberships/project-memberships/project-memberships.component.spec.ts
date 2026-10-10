// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CreateProjectMembershipCommand,
  EditProjectMembershipCommand,
  Group,
  GroupsService,
  Project,
  ProjectMembership,
  ProjectPermission,
  ProjectRole,
  ProjectRolesService,
  ProjectsService,
  SystemPermission,
  User,
  UsersService,
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectMembershipsComponent } from './project-memberships.component';

@Component({
  selector: 'cas-project-membership-list',
  template: '',
  standalone: false,
})
class MembershipListStub {
  @Input() users: User[];
  @Input() groups: Group[];
  @Input() canEdit: boolean;
  @Output() createMembership =
    new EventEmitter<CreateProjectMembershipCommand>();
}

@Component({
  selector: 'cas-project-member-list',
  template: '',
  standalone: false,
})
class MemberListStub {
  @Input() memberships: ProjectMembership[];
  @Input() users: User[];
  @Input() groups: Group[];
  @Input() roles: ProjectRole[];
  @Input() canEdit: boolean;
  @Output() deleteMembership = new EventEmitter<string>();
  @Output() editMembership = new EventEmitter<EditProjectMembershipCommand>();
}

async function renderMemberships(grants: PermissionGrants, embedded = false) {
  const projectsApi = {
    getProject: vi.fn((id: string) => of<Project>({ id, name: 'Range' })),
    getProjectMemberships: vi.fn((projectId: string) =>
      of<ProjectMembership[]>([
        { id: 'm1', projectId, userId: 'u1', roleId: 'r1' },
      ]),
    ),
    createProjectMembership: vi.fn((projectId: string) =>
      of<ProjectMembership>({
        id: 'm2',
        projectId,
        groupId: 'g1',
        roleId: 'r1',
      }),
    ),
  } satisfies ApiStub<ProjectsService>;
  const usersApi = {
    getAllUsers: vi.fn(() =>
      of<User[]>([
        { id: 'u1', name: 'Ada' },
        { id: 'u2', name: 'Grace' },
      ]),
    ),
  } satisfies ApiStub<UsersService>;
  const rolesApi = {
    getAllProjectRoles: vi.fn(() =>
      of<ProjectRole[]>([{ id: 'r1', name: 'Member' }]),
    ),
  } satisfies ApiStub<ProjectRolesService>;
  const groupsApi = {
    getAllGroups: vi.fn(() => of<Group[]>([{ id: 'g1', name: 'Blue Team' }])),
  } satisfies ApiStub<GroupsService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinProjectAdmin: vi.fn(),
    leaveProjectAdmin: vi.fn(),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'joinProjectAdmin' | 'leaveProjectAdmin'
  >;
  const goBack = vi.fn();
  const view = await renderComponent(ProjectMembershipsComponent, {
    declarations: [MembershipListStub, MemberListStub],
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ProjectsService, useValue: projectsApi },
      { provide: UsersService, useValue: usersApi },
      { provide: ProjectRolesService, useValue: rolesApi },
      { provide: GroupsService, useValue: groupsApi },
      { provide: SignalRService, useValue: signalR },
    ],
    inputs: { projectId: 'p1', embedded },
    on: { goBack },
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  const stub = <T>(type: Type<T>): T =>
    view.fixture.debugElement.query(By.directive(type)).componentInstance;
  return {
    ...view,
    projectsApi,
    signalR,
    goBack,
    stub,
    user: userEvent.setup(),
  };
}

describe('ProjectMembershipsComponent', () => {
  /**
   * Verifies: the page loads the project, joins its admin hub group, and splits users and groups into members and non-members.
   * Interacts with: ProjectsService, UsersService, ProjectRolesService and GroupsService (stubs), SignalRService (stub), real state services.
   * Data: project Range with member Ada; users Ada and Grace; group Blue Team.
   */
  it('lists members and non-members of the project', async () => {
    const { signalR, stub } = await renderMemberships({});

    expect(screen.getByRole('heading', { name: 'Range' })).toBeVisible();
    expect(signalR.joinProjectAdmin).toHaveBeenCalledWith('p1');
    expect(stub(MemberListStub).users.map((u) => u.name)).toEqual(['Ada']);
    expect(stub(MembershipListStub).users.map((u) => u.name)).toEqual([
      'Grace',
    ]);
    expect(stub(MembershipListStub).groups.map((g) => g.name)).toEqual([
      'Blue Team',
    ]);
  });

  /**
   * Verifies: an EditProject claim on the project makes both membership lists editable (current behavior).
   * Interacts with: PermissionService.canEditProject (real), the list stubs' canEdit inputs.
   * Data: an EditProject claim on p1.
   */
  it('passes canEdit true with an EditProject claim', async () => {
    const { stub } = await renderMemberships({
      projects: [
        { projectId: 'p1', permissions: [ProjectPermission.EditProject] },
      ],
    });

    // Current behavior; see agent-docs/ui-test-bugs/caster.ui.md.
    expect(stub(MembershipListStub).canEdit).toBe(true);
    expect(stub(MemberListStub).canEdit).toBe(true);
  });

  /**
   * Verifies: the EditProjects system permission makes both membership lists editable without a claim (current behavior).
   * Interacts with: PermissionService.canEditProject (real).
   * Data: system permission EditProjects.
   */
  it('passes canEdit true with EditProjects', async () => {
    const { stub } = await renderMemberships({
      system: [SystemPermission.EditProjects],
    });

    // Current behavior; see agent-docs/ui-test-bugs/caster.ui.md.
    expect(stub(MemberListStub).canEdit).toBe(true);
  });

  /**
   * Verifies: without EditProjects or an EditProject claim on this project both lists are read-only, also with a ManageProject claim or ManageProjects (current behavior).
   * Interacts with: PermissionService.canEditProject (real), the list stubs' canEdit inputs.
   * Data: near misses: EditProject on another project, ManageProject on p1, ManageProjects.
   */
  it.each<[string, PermissionGrants]>([
    [
      'an EditProject claim on another project',
      {
        projects: [
          { projectId: 'p9', permissions: [ProjectPermission.EditProject] },
        ],
      },
    ],
    [
      'a ManageProject claim',
      {
        projects: [
          { projectId: 'p1', permissions: [ProjectPermission.ManageProject] },
        ],
      },
    ],
    ['ManageProjects', { system: [SystemPermission.ManageProjects] }],
  ])('passes canEdit false with %s', async (_label, grants) => {
    const { stub } = await renderMemberships(grants);

    // Current behavior for the Manage rows; see agent-docs/ui-test-bugs/caster.ui.md.
    expect(stub(MembershipListStub).canEdit).toBe(false);
    expect(stub(MemberListStub).canEdit).toBe(false);
  });

  /**
   * Verifies: adding a membership from the list creates it for this project and passes it to the member list, and the embedded Return button emits goBack.
   * Interacts with: ProjectsService.createProjectMembership (stub), real ProjectMembershipService, the member list stub, the goBack output.
   * Data: embedded; group g1 added as membership m2.
   */
  it('creates a membership and returns when embedded', async () => {
    const { fixture, projectsApi, goBack, stub, user } =
      await renderMemberships(
        { system: [SystemPermission.EditProjects] },
        true,
      );

    stub(MembershipListStub).createMembership.emit({ groupId: 'g1' });
    fixture.detectChanges();
    expect(projectsApi.createProjectMembership).toHaveBeenCalledWith('p1', {
      groupId: 'g1',
    });
    expect(stub(MemberListStub).memberships.map((m) => m.id)).toEqual([
      'm1',
      'm2',
    ]);
    expect(stub(MemberListStub).groups.map((g) => g.name)).toEqual([
      'Blue Team',
    ]);

    await user.click(screen.getByRole('button', { name: 'Return' }));
    expect(goBack).toHaveBeenCalled();
  });
});
