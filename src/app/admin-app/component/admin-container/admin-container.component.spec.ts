// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ComnAuthService } from '@cmusei/crucible-common';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { User as OidcUser } from 'oidc-client-ts';
import {
  GroupPermission,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { TopbarView } from 'src/app/shared/components/top-bar/topbar.models';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminContainerComponent } from './admin-container.component';

@Component({ selector: 'cas-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: TopbarView;
  @Input() sidenav: unknown;
  @Output() sidenavToggle = new EventEmitter<boolean>();
}
@Component({ selector: 'cas-users', template: '', standalone: false })
class UsersStub {}
@Component({ selector: 'cas-admin-modules', template: '', standalone: false })
class ModulesStub {}
@Component({
  selector: 'cas-admin-workspaces',
  template: '',
  standalone: false,
})
class WorkspacesStub {}
@Component({ selector: 'cas-vlans', template: '', standalone: false })
class VlansStub {}
@Component({ selector: 'cas-admin-roles', template: '', standalone: false })
class RolesStub {}
@Component({ selector: 'cas-admin-groups', template: '', standalone: false })
class GroupsStub {}
@Component({ selector: 'cas-admin-projects', template: '', standalone: false })
class ProjectsStub {}

async function renderContainer(grants: PermissionGrants, section?: string) {
  // selectQueryParams is overloaded and generic; the container only calls
  // selectQueryParams('section').
  const routerQuery = {
    selectQueryParams: vi.fn(() => of(section ?? null)),
  } as unknown as Pick<RouterQuery, 'selectQueryParams'>;
  const auth = {
    user$: of(
      new OidcUser({
        access_token: '',
        token_type: 'Bearer',
        profile: { sub: 'u1', name: 'Ada', iss: '', aud: '', exp: 0, iat: 0 },
      }),
    ),
    logout: vi.fn(() => Promise.resolve()),
  } satisfies Pick<ComnAuthService, 'user$' | 'logout'>;
  const view = await renderComponent(AdminContainerComponent, {
    declarations: [
      TopbarStub,
      UsersStub,
      ModulesStub,
      WorkspacesStub,
      VlansStub,
      RolesStub,
      GroupsStub,
      ProjectsStub,
    ],
    imports: [
      MatSidenavModule,
      MatToolbarModule,
      MatListModule,
      MatButtonModule,
      MatIconModule,
    ],
    providers: [
      ...permissionDataProviders(grants),
      { provide: RouterQuery, useValue: routerQuery },
      { provide: ComnAuthService, useValue: auth },
    ],
  });
  return { ...view, user: userEvent.setup() };
}

/** The section buttons the sidenav renders, by accessible name. */
function navSections(): string[] {
  const list = document.querySelector('mat-list') as HTMLElement | null;
  return list
    ? within(list)
        .queryAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? '')
    : [];
}

describe('AdminContainerComponent', () => {
  /**
   * Verifies: each sidenav section appears only with its own system permission (Groups also with a ManageMembership claim), and near-miss grants render no section.
   * Interacts with: PermissionService.permissions$ and canViewGroupsAdmin (real), SystemPermissionsService and GroupPermissionsService (stubs).
   * Data: one grant per row; near misses are a sibling permission on the same resource (View instead of Manage, Manage instead of View, EditGroup instead of ManageMembership).
   */
  it.each<[string, PermissionGrants, string[]]>([
    [
      'ManageProjects',
      { system: [SystemPermission.ManageProjects] },
      ['Projects'],
    ],
    ['ViewProjects', { system: [SystemPermission.ViewProjects] }, []],
    [
      'ViewWorkspaces',
      { system: [SystemPermission.ViewWorkspaces] },
      ['Workspaces'],
    ],
    ['ManageWorkspaces', { system: [SystemPermission.ManageWorkspaces] }, []],
    ['ViewVlans', { system: [SystemPermission.ViewVlans] }, ['VLANs']],
    ['ManageVlans', { system: [SystemPermission.ManageVlans] }, []],
    ['ViewModules', { system: [SystemPermission.ViewModules] }, ['Modules']],
    ['ManageModules', { system: [SystemPermission.ManageModules] }, []],
    ['ViewUsers', { system: [SystemPermission.ViewUsers] }, ['Users']],
    ['ManageUsers', { system: [SystemPermission.ManageUsers] }, []],
    ['ViewRoles', { system: [SystemPermission.ViewRoles] }, ['Roles']],
    ['ManageRoles', { system: [SystemPermission.ManageRoles] }, []],
    ['ViewGroups', { system: [SystemPermission.ViewGroups] }, ['Groups']],
    ['ManageGroups', { system: [SystemPermission.ManageGroups] }, []],
    [
      'a ManageMembership claim',
      {
        groups: [
          { groupId: 'g1', permissions: [GroupPermission.ManageMembership] },
        ],
      },
      ['Groups'],
    ],
    [
      'an EditGroup claim',
      { groups: [{ groupId: 'g1', permissions: [GroupPermission.EditGroup] }] },
      [],
    ],
  ])('lists the sections for %s: %j', async (_label, grants, expected) => {
    await renderContainer(grants);

    expect(navSections()).toEqual(expected);
  });

  /**
   * Verifies: a user with every View permission and ManageProjects sees all seven sections in order.
   * Interacts with: PermissionService.permissions$ and canViewGroupsAdmin (real).
   * Data: ManageProjects plus the View permissions for workspaces, VLANs, modules, users, roles and groups.
   */
  it('lists every section for a full administrator', async () => {
    await renderContainer({
      system: [
        SystemPermission.ManageProjects,
        SystemPermission.ViewWorkspaces,
        SystemPermission.ViewVlans,
        SystemPermission.ViewModules,
        SystemPermission.ViewUsers,
        SystemPermission.ViewRoles,
        SystemPermission.ViewGroups,
      ],
    });

    expect(navSections()).toEqual([
      'Projects',
      'Workspaces',
      'VLANs',
      'Modules',
      'Users',
      'Roles',
      'Groups',
    ]);
  });

  /**
   * Verifies: the section named in the query string renders its admin page when the user holds that section's permission.
   * Interacts with: RouterQuery.selectQueryParams (stub), PermissionService.permissions$ (real).
   * Data: section Users; system permission ViewUsers.
   */
  it('renders the Users page for the Users section with ViewUsers', async () => {
    const { fixture } = await renderContainer(
      { system: [SystemPermission.ViewUsers] },
      'Users',
    );

    expect(fixture.nativeElement.querySelector('cas-users')).not.toBeNull();
  });

  /**
   * Verifies: the section named in the query string does not render its admin page without that section's View permission.
   * Interacts with: RouterQuery.selectQueryParams (stub), PermissionService.permissions$ (real).
   * Data: section Users; near miss: system permission ManageUsers instead of ViewUsers.
   */
  it('hides the Users page without ViewUsers', async () => {
    const { fixture } = await renderContainer(
      { system: [SystemPermission.ManageUsers] },
      'Users',
    );

    expect(fixture.nativeElement.querySelector('cas-users')).toBeNull();
  });

  /**
   * Verifies: each section named in the query string renders its admin page with that section's permission.
   * Interacts with: RouterQuery.selectQueryParams (stub), PermissionService.permissions$ (real).
   * Data: one row per section with its required permission (ManageProjects for Projects, View* for the others).
   */
  it.each([
    {
      section: 'Projects',
      page: 'cas-admin-projects',
      permission: SystemPermission.ManageProjects,
    },
    {
      section: 'Workspaces',
      page: 'cas-admin-workspaces',
      permission: SystemPermission.ViewWorkspaces,
    },
    {
      section: 'VLANs',
      page: 'cas-vlans',
      permission: SystemPermission.ViewVlans,
    },
    {
      section: 'Modules',
      page: 'cas-admin-modules',
      permission: SystemPermission.ViewModules,
    },
    {
      section: 'Roles',
      page: 'cas-admin-roles',
      permission: SystemPermission.ViewRoles,
    },
  ])(
    'renders the $section page with $permission',
    async ({ section, page, permission }) => {
      const { fixture } = await renderContainer(
        { system: [permission] },
        section,
      );

      expect(fixture.nativeElement.querySelector(page)).not.toBeNull();
    },
  );

  /**
   * Verifies: each section named in the query string does not render its admin page without that section's permission, though the URL reaches it without the nav button.
   * Interacts with: RouterQuery.selectQueryParams (stub), PermissionService.permissions$ (real).
   * Data: near misses: a sibling permission on the same resource (ViewProjects for Projects, Manage* instead of View* for the others).
   */
  it.each([
    {
      section: 'Projects',
      page: 'cas-admin-projects',
      permission: SystemPermission.ViewProjects,
    },
    {
      section: 'Workspaces',
      page: 'cas-admin-workspaces',
      permission: SystemPermission.ManageWorkspaces,
    },
    {
      section: 'VLANs',
      page: 'cas-vlans',
      permission: SystemPermission.ManageVlans,
    },
    {
      section: 'Modules',
      page: 'cas-admin-modules',
      permission: SystemPermission.ManageModules,
    },
    {
      section: 'Roles',
      page: 'cas-admin-roles',
      permission: SystemPermission.ManageRoles,
    },
  ])(
    'hides the $section page with only $permission',
    async ({ section, page, permission }) => {
      const { fixture } = await renderContainer(
        { system: [permission] },
        section,
      );

      expect(fixture.nativeElement.querySelector(page)).toBeNull();
    },
  );

  /**
   * Verifies: the Groups page renders for the Groups section with a ManageMembership claim and not with an EditGroup claim.
   * Interacts with: PermissionService.canViewGroupsAdmin (real), RouterQuery.selectQueryParams (stub).
   * Data: section Groups; a ManageMembership claim, then (near miss) an EditGroup claim on g1.
   */
  it.each([
    { permission: GroupPermission.ManageMembership, shown: true },
    { permission: GroupPermission.EditGroup, shown: false },
  ])(
    'renders the Groups page for a $permission claim: $shown',
    async ({ permission, shown }) => {
      const { fixture } = await renderContainer(
        { groups: [{ groupId: 'g1', permissions: [permission] }] },
        'Groups',
      );

      const page = fixture.nativeElement.querySelector('cas-admin-groups');
      expect(page !== null).toBe(shown);
    },
  );

  /**
   * Verifies: clicking a section merges its name into the section query parameter.
   * Interacts with: Router.navigate (spied on the real router).
   * Data: system permission ViewVlans; the VLANs section clicked.
   */
  it('navigates to the clicked section', async () => {
    const { user } = await renderContainer({
      system: [SystemPermission.ViewVlans],
    });
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);

    await user.click(screen.getByRole('button', { name: 'VLANs' }));

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { section: 'VLANs' },
      queryParamsHandling: 'merge',
    });
  });
});
