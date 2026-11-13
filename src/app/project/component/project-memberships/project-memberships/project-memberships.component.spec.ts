// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Type, input, output } from '@angular/core';
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
import { ProjectMemberListComponent } from 'src/app/project/component/project-memberships/project-member-list/project-member-list.component';
import { ProjectMembershipListComponent } from 'src/app/project/component/project-memberships/project-membership-list/project-membership-list.component';

@Component({
  selector: 'cas-project-membership-list',
  template: '',
})
class MembershipListStub {
  readonly users = input<User[]>(undefined);
  readonly groups = input<Group[]>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly createMembership = output<CreateProjectMembershipCommand>();
}

@Component({
  selector: 'cas-project-member-list',
  template: '',
})
class MemberListStub {
  readonly memberships = input<ProjectMembership[]>(undefined);
  readonly users = input<User[]>(undefined);
  readonly groups = input<Group[]>(undefined);
  readonly roles = input<ProjectRole[]>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly deleteMembership = output<string>();
  readonly editMembership = output<EditProjectMembershipCommand>();
}

async function renderMemberships(
  grants: PermissionGrants,
  embedded = false,
  showTitle = true,
) {
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
    childStubs: [
      { replace: ProjectMembershipListComponent, with: MembershipListStub },
      { replace: ProjectMemberListComponent, with: MemberListStub },
    ],
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ProjectsService, useValue: projectsApi },
      { provide: UsersService, useValue: usersApi },
      { provide: ProjectRolesService, useValue: rolesApi },
      { provide: GroupsService, useValue: groupsApi },
      { provide: SignalRService, useValue: signalR },
    ],
    inputs: { projectId: 'p1', embedded, showTitle },
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
    expect(
      stub(MemberListStub)
        .users()
        .map((u) => u.name),
    ).toEqual(['Ada']);
    expect(
      stub(MembershipListStub)
        .users()
        .map((u) => u.name),
    ).toEqual(['Grace']);
    expect(
      stub(MembershipListStub)
        .groups()
        .map((g) => g.name),
    ).toEqual(['Blue Team']);
  });

  /**
   * Verifies: with showTitle false (a host such as the admin Projects table already names the project) the project name heading is left out, while the membership lists still show and stay editable for a manager.
   * Interacts with: the showTitle input, PermissionService.canManageProject (real).
   * Data: project Range; ManageProjects.
   */
  it('leaves the title out when showTitle is false', async () => {
    const { stub } = await renderMemberships(
      { system: [SystemPermission.ManageProjects] },
      false,
      false,
    );

    expect(screen.queryByRole('heading', { name: 'Range' })).toBeNull();
    // Edit rights don't depend on the title being shown.
    expect(stub(MembershipListStub).canEdit()).toBe(true);
    expect(stub(MemberListStub).canEdit()).toBe(true);
  });

  /**
   * Verifies: a ManageProject claim on the project, or the ManageProjects system permission, makes both membership lists editable, as the API requires for adding, changing and removing memberships.
   * Interacts with: PermissionService.canManageProject (real), the list stubs' canEdit inputs.
   * Data: the grants in the row.
   */
  it.each<[string, PermissionGrants]>([
    [
      'a ManageProject claim',
      {
        projects: [
          { projectId: 'p1', permissions: [ProjectPermission.ManageProject] },
        ],
      },
    ],
    ['ManageProjects', { system: [SystemPermission.ManageProjects] }],
  ])('passes canEdit true with %s', async (_label, grants) => {
    const { stub } = await renderMemberships(grants);

    expect(stub(MembershipListStub).canEdit()).toBe(true);
    expect(stub(MemberListStub).canEdit()).toBe(true);
  });

  /**
   * Verifies: without ManageProjects or a ManageProject claim on this project both lists are read-only, including for EditProject and EditProjects, which the API refuses for memberships with a 403.
   * Interacts with: PermissionService.canManageProject (real), the list stubs' canEdit inputs.
   * Data: near misses: ManageProject on another project, EditProject on p1, EditProjects.
   */
  it.each<[string, PermissionGrants]>([
    [
      'a ManageProject claim on another project',
      {
        projects: [
          { projectId: 'p9', permissions: [ProjectPermission.ManageProject] },
        ],
      },
    ],
    [
      'an EditProject claim',
      {
        projects: [
          { projectId: 'p1', permissions: [ProjectPermission.EditProject] },
        ],
      },
    ],
    ['EditProjects', { system: [SystemPermission.EditProjects] }],
  ])('passes canEdit false with %s', async (_label, grants) => {
    const { stub } = await renderMemberships(grants);

    expect(stub(MembershipListStub).canEdit()).toBe(false);
    expect(stub(MemberListStub).canEdit()).toBe(false);
  });

  /**
   * Verifies: adding a membership from the list creates it for this project and passes it to the member list, and the embedded Return button emits goBack.
   * Interacts with: ProjectsService.createProjectMembership (stub), real ProjectMembershipService, the member list stub, the goBack output.
   * Data: embedded; group g1 added as membership m2.
   */
  it('creates a membership and returns when embedded', async () => {
    const { fixture, projectsApi, goBack, stub, user } =
      await renderMemberships(
        { system: [SystemPermission.ManageProjects] },
        true,
      );

    stub(MembershipListStub).createMembership.emit({ groupId: 'g1' });
    fixture.detectChanges();
    expect(projectsApi.createProjectMembership).toHaveBeenCalledWith('p1', {
      groupId: 'g1',
    });
    expect(
      stub(MemberListStub)
        .memberships()
        .map((m) => m.id),
    ).toEqual(['m1', 'm2']);
    expect(
      stub(MemberListStub)
        .groups()
        .map((g) => g.name),
    ).toEqual(['Blue Team']);

    await user.click(screen.getByRole('button', { name: 'Return' }));
    expect(goBack).toHaveBeenCalled();
  });
});
