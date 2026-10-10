// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  GroupPermission,
  ProjectPermission,
  SystemPermission,
} from '../../../generated/caster-api';
import {
  PermissionGrants,
  permissionDataProviders,
} from '../../../test-utils/mock-permission-data.service';
import { renderComponent } from '../../../test-utils/render-component';
import { CurrentUserStore } from '../../../users/state/user.store';
import { TopbarComponent } from './topbar.component';
import { TopbarView } from './topbar.models';

/**
 * Renders the top bar over the REAL PermissionService (primed with `grants`)
 * and a real CurrentUserStore, then opens the user menu, where the gated
 * links live.
 */
async function renderTopbar(
  grants: PermissionGrants = {},
  inputs: { projectId?: string; topbarView?: TopbarView } = {},
) {
  const user = userEvent.setup();
  const view = await renderComponent(TopbarComponent, {
    imports: [
      MatToolbarModule,
      MatMenuModule,
      MatButtonModule,
      MatIconModule,
      MatSlideToggleModule,
    ],
    providers: [...permissionDataProviders(grants)],
    inputs,
  });
  TestBed.inject(CurrentUserStore).update({ id: 'u1', name: 'Ada' });
  view.fixture.detectChanges();
  await user.click(screen.getByRole('button', { name: /Ada/ }));
  return { ...view, user };
}

/** Close to the admin gate on both paths: a non-View system permission and a non-ManageMembership group claim. */
const nearMissAdmin: PermissionGrants = {
  system: [SystemPermission.CreateProjects],
  groups: [{ groupId: 'g1', permissions: [GroupPermission.EditGroup] }],
};

describe('TopbarComponent', () => {
  /**
   * Verifies: a user with any View* system permission sees the Administration link.
   * Interacts with: PermissionService.canViewAdiminstration (real), SystemPermissionsService (stub).
   * Data: system permission ViewProjects; home view.
   */
  it('shows Administration with a View system permission', async () => {
    await renderTopbar({ system: [SystemPermission.ViewProjects] });

    expect(
      screen.getByRole('menuitem', { name: 'Administration' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: ViewHosts alone, a View* system permission no admin section reads, still shows the Administration link.
   * Interacts with: PermissionService.canViewAdiminstration (real, startsWith('View')), SystemPermissionsService (stub).
   * Data: exactly one system permission, ViewHosts; no group or project claims; home view.
   */
  it('shows Administration with only the ViewHosts system permission', async () => {
    await renderTopbar({ system: [SystemPermission.ViewHosts] });

    expect(
      screen.getByRole('menuitem', { name: 'Administration' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a user with no View* system permission and no ManageMembership group claim does not see the Administration link.
   * Interacts with: PermissionService.canViewAdiminstration (real), SystemPermissionsService and GroupPermissionsService (stubs).
   * Data: near miss: system permission CreateProjects, and an EditGroup (not ManageMembership) claim on g1.
   */
  it('hides Administration without a View system permission or ManageMembership claim', async () => {
    await renderTopbar(nearMissAdmin);

    expect(
      screen.queryByRole('menuitem', { name: 'Administration' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Logout' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a ManageMembership group claim alone grants the Administration link.
   * Interacts with: PermissionService.canViewAdiminstration (real), GroupPermissionsService (stub).
   * Data: no system permissions; group g1 claim with ManageMembership.
   */
  it('shows Administration to a group membership manager', async () => {
    await renderTopbar({
      groups: [
        { groupId: 'g1', permissions: [GroupPermission.ManageMembership] },
      ],
    });

    expect(
      screen.getByRole('menuitem', { name: 'Administration' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: inside the admin area the menu offers Exit Administration instead of Administration.
   * Interacts with: PermissionService.canViewAdiminstration (real).
   * Data: system permission ViewProjects; topbarView caster-admin.
   */
  it('offers Exit Administration in the admin view', async () => {
    await renderTopbar(
      { system: [SystemPermission.ViewProjects] },
      { topbarView: TopbarView.CASTER_ADMIN },
    );

    expect(
      screen.getByRole('menuitem', { name: 'Exit Administration' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Administration' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: inside the admin area a user without a View* system permission or ManageMembership claim sees neither Exit Administration nor Administration.
   * Interacts with: PermissionService.canViewAdiminstration (real), SystemPermissionsService and GroupPermissionsService (stubs).
   * Data: near miss: system permission CreateProjects, and an EditGroup claim on g1; topbarView caster-admin.
   */
  it('hides Exit Administration in the admin view without a View system permission or ManageMembership claim', async () => {
    await renderTopbar(nearMissAdmin, { topbarView: TopbarView.CASTER_ADMIN });

    expect(
      screen.queryByRole('menuitem', { name: 'Exit Administration' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Administration' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Logout' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: Manage Project appears with a ManageProject claim for this project and stays hidden with a claim for another project.
   * Interacts with: PermissionService.canManageProject (real), ProjectPermissionsService (stub).
   * Data: project claims for p1 (ManageProject) and p2 (EditProject).
   */
  it.each([
    { projectId: 'p1', shown: true },
    { projectId: 'p2', shown: false },
  ])(
    'shows Manage Project for $projectId: $shown',
    async ({ projectId, shown }) => {
      await renderTopbar(
        {
          projects: [
            { projectId: 'p1', permissions: [ProjectPermission.ManageProject] },
            { projectId: 'p2', permissions: [ProjectPermission.EditProject] },
          ],
        },
        { projectId },
      );

      const link = screen.queryByRole('menuitem', { name: 'Manage Project' });
      if (shown) {
        expect(link).toBeInTheDocument();
      } else {
        expect(link).not.toBeInTheDocument();
      }
    },
  );

  /**
   * Verifies: the ManageProjects system permission grants Manage Project without any project claim.
   * Interacts with: PermissionService.canManageProject (real).
   * Data: system permission ManageProjects; project p9 with no claim.
   */
  it('shows Manage Project to a system project manager', async () => {
    await renderTopbar(
      { system: [SystemPermission.ManageProjects] },
      { projectId: 'p9' },
    );

    expect(
      screen.getByRole('menuitem', { name: 'Manage Project' }),
    ).toBeInTheDocument();
  });
});
