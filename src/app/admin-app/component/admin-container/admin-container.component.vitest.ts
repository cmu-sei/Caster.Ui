// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/angular';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AdminContainerComponent } from './admin-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SystemPermission } from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import { SharedModule } from 'src/app/shared/shared.module';
import { of } from 'rxjs';
import { RouterQuery } from '@datorama/akita-ng-router-store';

const allViewPermissions = [
  SystemPermission.ManageProjects,
  SystemPermission.ViewUsers,
  SystemPermission.ViewModules,
  SystemPermission.ViewWorkspaces,
  SystemPermission.ViewVlans,
  SystemPermission.ViewRoles,
  SystemPermission.ViewGroups,
];

const sharedImports = [
  MatSidenavModule,
  MatListModule,
  MatIconModule,
  SharedModule,
];

function makePermProvider(permissions: SystemPermission[]) {
  return {
    provide: PermissionService,
    useValue: {
      permissions$: of(permissions),
      projectPermissions$: of([]),
      load: () => of(permissions),
      loadProjectPermissions: () => of([]),
      canViewAdiminstration: () => of(permissions.length > 0),
      hasPermission: (p: SystemPermission) => of(permissions.includes(p)),
      canEditProject: () => of(false),
      canManageProject: () => of(false),
      canAdminLockProject: () => of(false),
    },
  };
}

async function renderAdminContainer(permissions: SystemPermission[] = []) {
  return renderComponent(AdminContainerComponent, {
    declarations: [AdminContainerComponent],
    imports: sharedImports,
    providers: [
      {
        provide: RouterQuery,
        useValue: {
          selectQueryParams: () => of(null),
        },
      },
      makePermProvider(permissions),
    ],
  });
}

function getSidenav(container: HTMLElement): HTMLElement {
  return container.querySelector('mat-sidenav') as HTMLElement;
}

describe('AdminContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderAdminContainer();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show all menu items when user has all View permissions', async () => {
    const { container } = await renderAdminContainer(allViewPermissions);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    expect(sidenavScope.getByText('Projects')).toBeInTheDocument();
    expect(sidenavScope.getByText('Users')).toBeInTheDocument();
    expect(sidenavScope.getByText('Modules')).toBeInTheDocument();
    expect(sidenavScope.getByText('Workspaces')).toBeInTheDocument();
    expect(sidenavScope.getByText('VLANs')).toBeInTheDocument();
    expect(sidenavScope.getByText('Roles')).toBeInTheDocument();
    expect(sidenavScope.getByText('Groups')).toBeInTheDocument();
  });

  it('should hide all menu items when user has no permissions', async () => {
    const { container } = await renderAdminContainer([]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    expect(sidenavScope.queryByText('Projects')).toBeNull();
    expect(sidenavScope.queryByText('Users')).toBeNull();
    expect(sidenavScope.queryByText('Modules')).toBeNull();
    expect(sidenavScope.queryByText('Workspaces')).toBeNull();
    expect(sidenavScope.queryByText('VLANs')).toBeNull();
    expect(sidenavScope.queryByText('Roles')).toBeNull();
    expect(sidenavScope.queryByText('Groups')).toBeNull();
  });

  it('should show only Users when user has ViewUsers', async () => {
    const { container } = await renderAdminContainer([
      SystemPermission.ViewUsers,
    ]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    expect(sidenavScope.getByText('Users')).toBeInTheDocument();
    expect(sidenavScope.queryByText('Projects')).toBeNull();
    expect(sidenavScope.queryByText('Modules')).toBeNull();
    expect(sidenavScope.queryByText('Workspaces')).toBeNull();
    expect(sidenavScope.queryByText('VLANs')).toBeNull();
    expect(sidenavScope.queryByText('Roles')).toBeNull();
    expect(sidenavScope.queryByText('Groups')).toBeNull();
  });

  it('should show only Modules when user has ViewModules', async () => {
    const { container } = await renderAdminContainer([
      SystemPermission.ViewModules,
    ]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    expect(sidenavScope.getByText('Modules')).toBeInTheDocument();
    expect(sidenavScope.queryByText('Projects')).toBeNull();
    expect(sidenavScope.queryByText('Users')).toBeNull();
  });

  it('should show only VLANs when user has ViewVlans', async () => {
    const { container } = await renderAdminContainer([
      SystemPermission.ViewVlans,
    ]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    expect(sidenavScope.getByText('VLANs')).toBeInTheDocument();
    expect(sidenavScope.queryByText('Projects')).toBeNull();
    expect(sidenavScope.queryByText('Users')).toBeNull();
  });

  it('should show only Roles when user has ViewRoles', async () => {
    const { container } = await renderAdminContainer([
      SystemPermission.ViewRoles,
    ]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    expect(sidenavScope.getByText('Roles')).toBeInTheDocument();
    expect(sidenavScope.queryByText('Projects')).toBeNull();
    expect(sidenavScope.queryByText('Users')).toBeNull();
  });

  it('should show only Groups when user has ViewGroups', async () => {
    const { container } = await renderAdminContainer([
      SystemPermission.ViewGroups,
    ]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    expect(sidenavScope.getByText('Groups')).toBeInTheDocument();
    expect(sidenavScope.queryByText('Projects')).toBeNull();
    expect(sidenavScope.queryByText('Users')).toBeNull();
  });

  it('should have clickable sidebar menu items', async () => {
    const { container } = await renderAdminContainer(allViewPermissions);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    const items = [
      'Users',
      'Modules',
      'Workspaces',
      'VLANs',
      'Roles',
      'Groups',
      'Projects',
    ];
    items.forEach((item) => {
      const el = sidenavScope.getByText(item);
      expect(el.closest('mat-list-item')).toBeInTheDocument();
    });
  });

  it('should show right arrow icon for each menu item', async () => {
    const { container } = await renderAdminContainer(allViewPermissions);

    expect(
      container.querySelectorAll(
        'mat-list-item mat-icon[fontIcon="mdi-menu-right"]'
      )
    ).toHaveLength(7);
  });

  it('should display correct icon for Users menu item', async () => {
    const { container } = await renderAdminContainer([
      SystemPermission.ViewUsers,
    ]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    const usersEl = sidenavScope.getByText('Users');
    const listItem = usersEl.closest('mat-list-item');
    expect(
      listItem.querySelector('mat-icon[fontIcon="mdi-account-multiple"]')
    ).toBeInTheDocument();
  });

  it('should display correct icon for Modules menu item', async () => {
    const { container } = await renderAdminContainer([
      SystemPermission.ViewModules,
    ]);
    const sidenav = getSidenav(container);
    const sidenavScope = within(sidenav);

    const modulesEl = sidenavScope.getByText('Modules');
    const listItem = modulesEl.closest('mat-list-item');
    expect(
      listItem.querySelector('mat-icon[fontIcon="mdi-view-module"]')
    ).toBeInTheDocument();
  });

  it('should show Administration heading in sidebar', async () => {
    await renderAdminContainer(allViewPermissions);

    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should start with sidebar open', async () => {
    const { container } = await renderAdminContainer(allViewPermissions);

    expect(container.querySelector('mat-sidenav')).toHaveClass(
      'mat-drawer-opened'
    );
  });
});
