// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { of } from 'rxjs';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetsService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminEnvironmentSetsComponent } from './admin-environment-sets.component';
import { EnvironmentSetDetailComponent } from './environment-set-detail/environment-set-detail.component';

@Component({ selector: 'cas-environment-set-detail', template: '' })
class DetailStub {
  readonly set = input<EnvironmentSet>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly secrets = input<EnvironmentSecrets>(undefined);
}

const sets: EnvironmentSet[] = [
  {
    id: 's1',
    name: 'vSphere',
    description: 'vCenter credentials',
    isComplete: false,
    entries: [
      {
        id: 'e1',
        environmentSetId: 's1',
        kind: 'EnvironmentVariable',
        targetName: 'VSPHERE_PASSWORD',
        valueSource: 'Secret',
        secretName: 'CASTER_SECRET_VSPHERE_PASSWORD',
        isAvailable: false,
      },
    ],
    projects: [
      { projectId: 'p1', name: 'Range A' },
      { projectId: 'p2', name: 'Range B' },
    ],
  },
  { id: 's2', name: 'AWS', isComplete: true, entries: [], projects: [] },
];

const secrets: EnvironmentSecrets = {
  available: ['CASTER_SECRET_AWS_KEY'],
  missing: ['CASTER_SECRET_VSPHERE_PASSWORD'],
  patterns: ['^CASTER_SECRET_'],
  runMode: 'Kubernetes',
  inheritAll: false,
};

async function renderPage(grants: PermissionGrants, confirmAnswer?: boolean) {
  const api = {
    getEnvironmentSets: vi.fn(() => of(structuredClone(sets))),
    getEnvironmentSecrets: vi.fn(() => of(secrets)),
    deleteEnvironmentSet: vi.fn(() => of<unknown>(null)),
  } satisfies ApiStub<EnvironmentSetsService>;
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinEnvironmentSetsAdmin: vi.fn(),
    leaveEnvironmentSetsAdmin: vi.fn(),
  };
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);

  const view = await renderComponent(AdminEnvironmentSetsComponent, {
    childStubs: [{ replace: EnvironmentSetDetailComponent, with: DetailStub }],
    imports: [
      MatTableModule,
      MatSortModule,
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatDialogModule,
      MatTabsModule,
    ],
    providers: [
      ...permissionDataProviders(grants),
      { provide: EnvironmentSetsService, useValue: api },
      { provide: SignalRService, useValue: signalR },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
  });
  await view.fixture.whenStable();

  return { ...view, api, signalR, confirm, user: userEvent.setup() };
}

function rowOf(name: string) {
  return screen.getByRole('cell', { name }).closest('tr') as HTMLElement;
}

const manage: PermissionGrants = {
  system: [
    SystemPermission.ViewEnvironmentSets,
    SystemPermission.ManageEnvironmentSets,
  ],
};

describe('AdminEnvironmentSetsComponent', () => {
  /**
   * Verifies: the sets are listed by name with their status and project count, and the page joins the admin SignalR group.
   * Interacts with: getEnvironmentSets (stub), real EnvironmentSetService, SignalRService (stub).
   * Data: an incomplete set on two projects and a complete one on none.
   */
  it('lists the sets with their status and projects', async () => {
    const { signalR } = await renderPage(manage);

    expect(
      within(rowOf('vSphere')).getByText('Incomplete'),
    ).toBeInTheDocument();
    expect(within(rowOf('vSphere')).getByText('2')).toBeInTheDocument();
    expect(within(rowOf('AWS')).getByText('Complete')).toBeInTheDocument();
    expect(signalR.joinEnvironmentSetsAdmin).toHaveBeenCalled();
  });

  /**
   * Verifies: the Sets tab sums up how runs execute and how many secrets are missing, and the Secrets tab lists every name with its status and the sets using it.
   * Interacts with: getEnvironmentSecrets (stub); the Secrets tab.
   * Data: Kubernetes job mode; one available and one missing name; the missing one used by vSphere.
   */
  it('sums up the run mode and lists the secrets on their own tab', async () => {
    const { user } = await renderPage(manage);

    expect(
      screen.getByText(/Runs execute as\s+Kubernetes jobs/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 missing\s+secret/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Secrets' }));

    const missing = screen
      .getByText('CASTER_SECRET_VSPHERE_PASSWORD')
      .closest('tr') as HTMLElement;
    expect(within(missing).getByText('Missing')).toBeInTheDocument();
    expect(within(missing).getByText('vSphere')).toBeInTheDocument();
    const available = screen
      .getByText('CASTER_SECRET_AWS_KEY')
      .closest('tr') as HTMLElement;
    expect(within(available).getByText('Available')).toBeInTheDocument();
    expect(within(available).getByText('Not used')).toBeInTheDocument();
  });

  /**
   * Verifies: several sets can be expanded at once, and Collapse all closes them.
   * Interacts with: the row click toggle and the Expand all / Collapse all buttons; the detail stub.
   * Data: both sets.
   */
  it('expands several sets at once', async () => {
    const { user, fixture } = await renderPage(manage);

    await user.click(screen.getByRole('cell', { name: 'vSphere' }));
    await user.click(screen.getByRole('cell', { name: 'AWS' }));
    expect(
      fixture.nativeElement.querySelectorAll('cas-environment-set-detail')
        .length,
    ).toBe(2);

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(
      fixture.nativeElement.querySelectorAll('cas-environment-set-detail')
        .length,
    ).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(
      fixture.nativeElement.querySelectorAll('cas-environment-set-detail')
        .length,
    ).toBe(2);
  });

  /**
   * Verifies: deleting a set asks first, naming the projects it is assigned to, then deletes it.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), deleteEnvironmentSet (stub).
   * Data: vSphere, assigned to Range A and Range B.
   */
  it('deletes a set after confirming, naming its projects', async () => {
    const { user, confirm, api } = await renderPage(manage, true);

    await user.click(screen.getByRole('button', { name: 'Delete vSphere' }));

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Environment Set',
        message: expect.stringContaining('Range A, Range B'),
      }),
    );
    expect(api.deleteEnvironmentSet).toHaveBeenCalledWith('s1');
    expect(screen.queryByRole('cell', { name: 'vSphere' })).toBeNull();
  });

  /**
   * Verifies: without ManageEnvironmentSets, add, edit and delete are disabled.
   * Interacts with: PermissionService.hasPermission (real).
   * Data: ViewEnvironmentSets only (the Observer's grant).
   */
  it('disables the writes for a caller holding only ViewEnvironmentSets', async () => {
    await renderPage({ system: [SystemPermission.ViewEnvironmentSets] });

    expect(
      screen.getByRole('button', { name: 'Add Environment Set' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete vSphere' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit vSphere' })).toBeDisabled();
  });
});
