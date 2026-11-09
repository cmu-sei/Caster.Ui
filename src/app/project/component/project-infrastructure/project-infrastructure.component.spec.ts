// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  EnvironmentSet,
  EnvironmentSetsService,
  InventoryService,
  ProjectInventoryService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { ProjectEnvironmentSetsViewComponent } from 'src/app/environment-sets/project-environment-sets-view/project-environment-sets-view.component';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectInfrastructureComponent } from './project-infrastructure.component';

@Component({ selector: 'cas-project-environment-sets-view', template: '' })
class SetsViewStub {
  readonly projectId = input<string>(undefined);
}

const proxmoxSet: EnvironmentSet = {
  id: 's1',
  name: 'Proxmox',
  entries: [
    {
      id: 'e1',
      kind: 'EnvironmentVariable',
      targetName: 'PROXMOX_VE_API_TOKEN',
      valueSource: 'Connection',
      connectionName: 'lab-pve',
      connectionField: 'ApiToken',
    },
  ],
  projects: [],
};

async function renderDialog(grants: PermissionGrants, confirmAnswer = true) {
  const projectInventory = {
    getProjectInventoryConnections: vi.fn(() =>
      of([
        {
          name: 'lab-vcenter',
          provider: 'vsphere',
          enabled: true,
          status: 'Available' as const,
        },
      ]),
    ),
    assignProjectInventoryConnection: vi.fn(() =>
      of([
        {
          name: 'lab-vcenter',
          provider: 'vsphere',
          enabled: true,
          status: 'Available' as const,
        },
        {
          name: 'lab-pve',
          provider: 'proxmox',
          enabled: true,
          status: 'Available' as const,
        },
      ]),
    ),
    unassignProjectInventoryConnection: vi.fn(() => of([])),
  };
  const inventory = {
    getInventoryConnections: vi.fn(() =>
      of([
        { name: 'lab-vcenter', provider: 'vsphere', enabled: true },
        { name: 'lab-pve', provider: 'proxmox', enabled: true },
      ]),
    ),
  };
  const sets = {
    getEnvironmentSets: vi.fn(() => of([proxmoxSet])),
    assignEnvironmentSet: vi.fn(() => of([])),
    getEnvironmentSet: vi.fn(() => of(proxmoxSet)),
    getProjectEnvironmentSets: vi.fn(() => of([])),
  };
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);

  const view = await renderComponent(ProjectInfrastructureComponent, {
    childStubs: [
      { replace: ProjectEnvironmentSetsViewComponent, with: SetsViewStub },
    ],
    providers: [
      ...permissionDataProviders(grants),
      {
        provide: MAT_DIALOG_DATA,
        useValue: { projectId: 'p1', projectName: 'Range A' },
      },
      { provide: MatDialogRef, useValue: dialogRefStub<ProjectInfrastructureComponent>().dialogRef },
      { provide: ProjectInventoryService, useValue: projectInventory },
      { provide: InventoryService, useValue: inventory },
      { provide: EnvironmentSetsService, useValue: sets },
      { provide: CrucibleDialogService, useValue: { confirm } },
    ],
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();

  return {
    ...view,
    projectInventory,
    inventory,
    sets,
    confirm,
    user: userEvent.setup(),
  };
}

describe('ProjectInfrastructureComponent', () => {
  /**
   * Verifies: members see the project's connections without assign controls, and the full connection list isn't read.
   * Interacts with: ProjectInventoryService.getProjectInventoryConnections (stub).
   * Data: lab-vcenter assigned; no system permissions.
   */
  it("lists the project's connections to its members", async () => {
    const { inventory } = await renderDialog({});

    expect(screen.getByText(/lab-vcenter/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove lab-vcenter' }),
    ).toBeNull();
    expect(inventory.getInventoryConnections).not.toHaveBeenCalled();
  });

  /**
   * Verifies: assigning a set that reads an unassigned connection offers to show that connection's inventory.
   * Interacts with: assignEnvironmentSet and assignProjectInventoryConnection (stubs); the confirm dialog (answering yes).
   * Data: Proxmox reads lab-pve; ManageInfrastructure and ManageEnvironmentSets.
   */
  it("offers a set's connection after assigning the set", async () => {
    const { fixture, sets, projectInventory, confirm } = await renderDialog({
      system: [
        SystemPermission.ManageInfrastructure,
        SystemPermission.ManageEnvironmentSets,
        SystemPermission.ViewEnvironmentSets,
        SystemPermission.ViewInfrastructure,
      ],
    });

    fixture.componentInstance.assignSet('s1');

    expect(sets.assignEnvironmentSet).toHaveBeenCalledWith('p1', 's1');
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('lab-pve') }),
    );
    expect(
      projectInventory.assignProjectInventoryConnection,
    ).toHaveBeenCalledWith('p1', 'lab-pve');
  });
});
