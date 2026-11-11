// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CapacityCheck, CapacityService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { RunCapacityComponent } from './run-capacity.component';

const warning: CapacityCheck = {
  status: 'Warning',
  roomCheck: 'Warn',
  canApply: true,
  requiresAcknowledgement: true,
  message:
    'The hypervisors may not have room for this run. pve1 needs 8 vCPUs and 16 GiB of memory and has 2 vCPUs and 64 GiB of memory free.',
  requested: { machines: 2, vcpu: 8, memoryMiB: 16384, diskGiB: 64 },
  after: { machines: 3, vcpu: 10, memoryMiB: 20480, diskGiB: 96 },
  limits: { maxVcpu: { value: 32, source: 'Project' } },
  limitViolations: [],
  hosts: [
    {
      hypervisor: 'proxmox',
      host: 'pve1',
      needVcpu: 8,
      needMemoryMiB: 16384,
      freeVcpu: 2,
      freeMemoryMiB: 65536,
      online: true,
      fits: false,
    },
  ],
  datastores: [
    {
      hypervisor: 'proxmox',
      datastore: 'local-lvm',
      needGiB: 64,
      freeGiB: 500,
      fits: true,
    },
  ],
  notes: [
    'Room on the vSphere hosts was not checked: the inventory has none to read.',
  ],
};

const refused: CapacityCheck = {
  status: 'Refused',
  roomCheck: 'Warn',
  canApply: false,
  requiresAcknowledgement: false,
  message:
    'This run would leave the workspace with 40 vCPUs, over its limit of 32 vCPUs (set on the project); it has 10 now.',
  requested: { machines: 4, vcpu: 30, memoryMiB: 8192, diskGiB: 10 },
  after: { machines: 5, vcpu: 40, memoryMiB: 12288, diskGiB: 20 },
  limits: { maxVcpu: { value: 32, source: 'Project' } },
  limitViolations: [
    { limit: 'MaxVcpu', value: 32, source: 'Project', total: 40, before: 10 },
  ],
  hosts: [],
  datastores: [],
  notes: [],
};

async function renderCapacity(check: CapacityCheck | 'error', canEdit = true) {
  const capacityApi = {
    getRunCapacity: vi.fn((_runId: string) =>
      check === 'error' ? throwError(() => new Error('boom')) : of(check),
    ),
  } satisfies ApiStub<CapacityService>;
  const checked = vi.fn();
  const acknowledgedChange = vi.fn();
  const view = await renderComponent(RunCapacityComponent, {
    imports: [MatCheckboxModule],
    providers: [{ provide: CapacityService, useValue: capacityApi }],
    inputs: { runId: 'run1', canEdit },
    on: { checked, acknowledged: acknowledgedChange },
  });
  return {
    ...view,
    capacityApi,
    checked,
    acknowledgedChange,
    user: userEvent.setup(),
  };
}

describe('RunCapacityComponent', () => {
  /**
   * Verifies: a room warning shows what the run adds, the host line that does not fit, the limits and the notes, and its acknowledge checkbox emits the acknowledgement.
   * Interacts with: CapacityService.getRunCapacity (stub); the checked and acknowledgedChange outputs.
   * Data: a Warning check: 2 machines, pve1 short of vCPU, a project vCPU limit of 32.
   */
  it('shows a room warning that can be acknowledged', async () => {
    const { capacityApi, checked, acknowledgedChange, user } =
      await renderCapacity(warning);

    expect(capacityApi.getRunCapacity).toHaveBeenCalledWith('run1');
    expect(checked).toHaveBeenCalledWith(warning);
    expect(screen.getByText('Not enough room.')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Adds 2\s+machines, 8 vCPU, 16 GiB memory, 64 GiB disk\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/pve1 needs 8 vCPUs/)).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /pve1/ })).toHaveClass('over');
    expect(screen.getByRole('row', { name: /local-lvm/ })).not.toHaveClass(
      'over',
    );
    expect(
      screen.getByRole('row', { name: /vCPU 10 32 \(project\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/vSphere hosts was not checked/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Apply anyway/ }));

    expect(acknowledgedChange).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: a refusal shows its reason and the limit it is over, and offers no acknowledgement.
   * Interacts with: CapacityService.getRunCapacity (stub).
   * Data: a Refused check, 40 vCPUs over a project limit of 32.
   */
  it('shows a refusal without an acknowledge checkbox', async () => {
    await renderCapacity(refused);

    expect(screen.getByText('Apply refused.')).toBeInTheDocument();
    expect(screen.getByText(/over its limit of 32 vCPUs/)).toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /vCPU 40 32 \(project\)/ }),
    ).toHaveClass('over');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  /**
   * Verifies: without canEdit the acknowledge checkbox is disabled.
   * Interacts with: the canEdit input.
   * Data: a Warning check; canEdit false.
   */
  it('disables the acknowledgement without canEdit', async () => {
    await renderCapacity(warning, false);

    expect(
      screen.getByRole('checkbox', { name: /Apply anyway/ }),
    ).toBeDisabled();
  });

  /**
   * Verifies: a check that cannot be loaded says so.
   * Interacts with: CapacityService.getRunCapacity (stub, errors).
   * Data: none.
   */
  it('says when the check cannot be loaded', async () => {
    await renderCapacity('error');

    expect(
      screen.getByText('The capacity check could not be loaded.'),
    ).toBeInTheDocument();
  });
});
