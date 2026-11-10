// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  AssignmentsService,
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
import { ProjectEnvironmentComponent } from './project-environment.component';

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

const admin: PermissionGrants = {
  system: [
    SystemPermission.ManageInfrastructure,
    SystemPermission.ManageEnvironmentSets,
    SystemPermission.ViewEnvironmentSets,
    SystemPermission.ViewInfrastructure,
  ],
};

async function renderDialog(
  grants: PermissionGrants,
  editAssignments = vi.fn(() => of<unknown>(null)),
  projectSets: unknown[] = [],
) {
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
    getEnvironmentSet: vi.fn(() => of(proxmoxSet)),
    getProjectEnvironmentSets: vi.fn(() => of(projectSets)),
  };
  const assignments = { editAssignments };

  const view = await renderComponent(ProjectEnvironmentComponent, {
    childStubs: [
      { replace: ProjectEnvironmentSetsViewComponent, with: SetsViewStub },
    ],
    providers: [
      ...permissionDataProviders(grants),
      {
        provide: MAT_DIALOG_DATA,
        useValue: { projectId: 'p1', projectName: 'Range A' },
      },
      {
        provide: MatDialogRef,
        useValue: dialogRefStub<ProjectEnvironmentComponent>().dialogRef,
      },
      { provide: ProjectInventoryService, useValue: projectInventory },
      { provide: InventoryService, useValue: inventory },
      { provide: EnvironmentSetsService, useValue: sets },
      { provide: AssignmentsService, useValue: assignments },
    ],
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();

  return {
    ...view,
    projectInventory,
    inventory,
    sets,
    assignments,
    user: userEvent.setup(),
  };
}

describe('ProjectEnvironmentComponent', () => {
  /**
   * Verifies: members see the project's connections, without a way to change them, and the full connection list isn't read.
   * Interacts with: ProjectInventoryService.getProjectInventoryConnections (stub).
   * Data: lab-vcenter assigned; no system permissions.
   */
  it("lists the project's connections to its members", async () => {
    const { user, inventory } = await renderDialog({});

    await user.click(screen.getByRole('tab', { name: 'Connections' }));

    expect(screen.getByText(/lab-vcenter/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Change Assignments/ }),
    ).toBeNull();
    expect(inventory.getInventoryConnections).not.toHaveBeenCalled();
  });

  /**
   * Verifies: choosing a set that reads a connection the project doesn't show offers that connection, and one save sends both.
   * Interacts with: AssignmentsService.editAssignments (stub).
   * Data: Proxmox reads lab-pve; lab-vcenter already shown.
   */
  it("offers a set's connection, and saves both together", async () => {
    const { user, assignments } = await renderDialog(admin);

    await user.click(
      screen.getByRole('button', { name: /Change Assignments/ }),
    );
    await user.click(screen.getByRole('checkbox', { name: /Proxmox/ }));
    await user.click(screen.getByRole('button', { name: 'Also show lab-pve' }));
    await user.click(screen.getByRole('button', { name: 'Save 2 changes' }));

    expect(assignments.editAssignments).toHaveBeenCalledWith({
      changes: [
        { operation: 'Add', projectId: 'p1', environmentSetId: 's1' },
        { operation: 'Add', projectId: 'p1', connectionName: 'lab-pve' },
      ],
    });
    expect(
      screen.getByRole('button', { name: /Change Assignments/ }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: unchecking a connection removes it by its configured name.
   * Interacts with: AssignmentsService.editAssignments (stub).
   * Data: lab-vcenter shown.
   */
  it('removes a connection', async () => {
    const { user, assignments } = await renderDialog(admin);

    await user.click(
      screen.getByRole('button', { name: /Change Assignments/ }),
    );
    await user.click(screen.getByRole('tab', { name: 'Connections' }));
    await user.click(screen.getByRole('checkbox', { name: /lab-vcenter/ }));
    await user.click(screen.getByRole('button', { name: 'Save 1 change' }));

    expect(assignments.editAssignments).toHaveBeenCalledWith({
      changes: [
        {
          operation: 'Remove',
          projectId: 'p1',
          connectionName: 'lab-vcenter',
        },
      ],
    });
  });

  /**
   * Verifies: a refused save shows the API's reason and keeps the changes open.
   * Interacts with: AssignmentsService.editAssignments (stub answering 409).
   */
  it('shows why a save was refused', async () => {
    const { user } = await renderDialog(
      admin,
      vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { title: 'REGION would be set by both' },
            }),
        ),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: /Change Assignments/ }),
    );
    await user.click(screen.getByRole('checkbox', { name: /Proxmox/ }));
    await user.click(screen.getByRole('button', { name: 'Save 1 change' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'REGION would be set by both',
    );
    expect(
      screen.getByRole('button', { name: 'Save 1 change' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a set the project gets through its group is checked, locked and named as such, and isn't sent as a change.
   * Data: Proxmox comes through group Lab only.
   */
  it('locks what comes through the group', async () => {
    const { user } = await renderDialog(admin, undefined, [
      {
        environmentSetId: 's1',
        projectId: 'p1',
        name: 'Proxmox',
        isDirect: false,
        projectGroups: [{ projectGroupId: 'g1', name: 'Lab' }],
        entries: [],
      },
    ]);

    await user.click(
      screen.getByRole('button', { name: /Change Assignments/ }),
    );

    const proxmox = screen.getByRole('checkbox', { name: /Proxmox/ });
    expect(proxmox).toBeChecked();
    expect(proxmox).toBeDisabled();
    expect(screen.getByText('via group Lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
