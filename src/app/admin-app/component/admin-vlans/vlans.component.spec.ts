// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTabsModule } from '@angular/material/tabs';
import { Project, SystemPermission } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VlansComponent } from './vlans.component';

@Component({ selector: 'cas-pools', template: '', standalone: false })
class PoolsStub {
  @Input() canEdit: boolean;
}

@Component({ selector: 'cas-project-vlans', template: '', standalone: false })
class ProjectVlansStub {
  @Input() projects: Project[];
  @Input() canEdit: boolean;
}

async function renderVlans(grants: PermissionGrants) {
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinVlansAdmin: vi.fn(),
    leaveVlansAdmin: vi.fn(),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'joinVlansAdmin' | 'leaveVlansAdmin'
  >;
  const view = await renderComponent(VlansComponent, {
    declarations: [PoolsStub, ProjectVlansStub],
    imports: [MatTabsModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: SignalRService, useValue: signalR },
    ],
  });
  await view.fixture.whenStable();
  return { ...view, signalR, user: userEvent.setup() };
}

const manage: PermissionGrants = { system: [SystemPermission.ManageVlans] };
/** Near miss: the View permission on the same resource. */
const viewOnly: PermissionGrants = { system: [SystemPermission.ViewVlans] };

describe('VlansComponent', () => {
  /**
   * Verifies: the page joins the VLAN admin hub group and passes canEdit true to the pools tab with ManageVlans.
   * Interacts with: SignalRService (stub), PermissionService.hasPermission (real), the pools stub's canEdit input.
   * Data: system permission ManageVlans; Pools tab (the default).
   */
  it('lets a VLAN manager edit the pools', async () => {
    const { fixture, signalR } = await renderVlans(manage);

    expect(signalR.joinVlansAdmin).toHaveBeenCalled();
    const pools: PoolsStub = fixture.debugElement.query(
      By.directive(PoolsStub),
    ).componentInstance;
    expect(pools.canEdit).toBe(true);
  });

  /**
   * Verifies: without ManageVlans the pools tab gets canEdit false.
   * Interacts with: PermissionService.hasPermission (real), the pools stub's canEdit input.
   * Data: near miss: system permission ViewVlans only.
   */
  it('keeps the pools read-only without ManageVlans', async () => {
    const { fixture } = await renderVlans(viewOnly);

    const pools: PoolsStub = fixture.debugElement.query(
      By.directive(PoolsStub),
    ).componentInstance;
    expect(pools.canEdit).toBe(false);
  });

  /**
   * Verifies: the Projects tab passes canEdit to the project VLANs view, true with ManageVlans and false with ViewVlans.
   * Interacts with: PermissionService.hasPermission (real), the project-vlans stub's canEdit input.
   * Data: ManageVlans, then (near miss) ViewVlans; the Projects tab clicked.
   */
  it.each([
    { label: 'ManageVlans', grants: manage, canEdit: true },
    { label: 'ViewVlans', grants: viewOnly, canEdit: false },
  ])(
    'passes canEdit $canEdit to the Projects tab with $label',
    async ({ grants, canEdit }) => {
      const { fixture, user } = await renderVlans(grants);

      await user.click(screen.getByRole('tab', { name: 'Projects' }));
      await fixture.whenStable();

      const projectVlans: ProjectVlansStub = fixture.debugElement.query(
        By.directive(ProjectVlansStub),
      ).componentInstance;
      expect(projectVlans.canEdit).toBe(canEdit);
    },
  );
});
