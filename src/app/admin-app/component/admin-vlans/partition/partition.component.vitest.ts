// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Partition } from 'src/app/generated/caster-api';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { VlanQuery } from 'src/app/vlans/state/vlan/vlan.query';
import { VlanService } from 'src/app/vlans/state/vlan/vlan.service';
import { PartitionComponent } from './partition.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const partition: Partition = {
  id: 'p1',
  name: 'Alpha',
  poolId: 'pool-1',
  isDefault: false,
} as Partition;

async function renderPart(
  overrides: { confirmCancel?: boolean; canEdit?: boolean } = {},
) {
  const { confirmCancel = false, canEdit = true } = overrides;

  const partitionService = {
    delete: vi.fn(() => of({})),
    partialEdit: vi.fn(() => of({})),
    unsetDefault: vi.fn(() => of({})),
    setDefault: vi.fn(() => of({})),
  };
  const vlanService = {
    addToPartition: vi.fn(() => of({})),
    removeFromPartition: vi.fn(() => of({})),
  };
  const snackBarOpen = vi.fn();

  const rendered = await renderComponent(PartitionComponent, {
    declarations: [PartitionComponent],
    imports: [MatSnackBarModule],
    schemas: [NO_ERRORS_SCHEMA],
    componentProperties: { partition, canEdit },
    providers: [
      { provide: PartitionService, useValue: partitionService },
      {
        provide: PartitionQuery,
        useValue: { selectByPoolId: vi.fn(() => of([])) },
      },
      { provide: VlanService, useValue: vlanService },
      {
        provide: VlanQuery,
        useValue: {
          selectUnassignedByPoolId: vi.fn(() => of([])),
          selectByPartitionId: vi.fn(() => of([])),
        },
      },
      {
        provide: ConfirmDialogService,
        useValue: { confirmDialog: () => of({ wasCancelled: confirmCancel }) },
      },
      { provide: MatSnackBar, useValue: { open: snackBarOpen } },
    ],
  });
  return { ...rendered, partitionService, vlanService, snackBarOpen };
}

describe('PartitionComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderPart();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('delete() only deletes when confirm returns wasCancelled=false', async () => {
    const { fixture, partitionService } = await renderPart({ confirmCancel: false });
    fixture.componentInstance.delete({ stopPropagation: () => {} });
    expect(partitionService.delete).toHaveBeenCalledWith('p1');
  });

  it('delete() is a no-op when confirm is cancelled', async () => {
    const { fixture, partitionService } = await renderPart({ confirmCancel: true });
    fixture.componentInstance.delete({ stopPropagation: () => {} });
    expect(partitionService.delete).not.toHaveBeenCalled();
  });

  it('rename() dispatches partialEdit with the new name', async () => {
    const { fixture, partitionService } = await renderPart();
    fixture.componentInstance.rename(
      { stopPropagation: () => {} },
      { value: 'NewName' },
    );
    expect(partitionService.partialEdit).toHaveBeenCalledWith('p1', {
      name: 'NewName',
    });
  });

  it('addVlans() dispatches to vlanService.addToPartition', async () => {
    const { fixture, vlanService } = await renderPart();
    fixture.componentInstance.addVlans({ stopPropagation: () => {} }, ['v1']);
    expect(vlanService.addToPartition).toHaveBeenCalledWith('p1', ['v1']);
  });

  it('removeVlans() dispatches to vlanService.removeFromPartition', async () => {
    const { fixture, vlanService } = await renderPart();
    fixture.componentInstance.removeVlans({ stopPropagation: () => {} }, ['v1']);
    expect(vlanService.removeFromPartition).toHaveBeenCalledWith('p1', ['v1']);
  });

  it('setDefault() / unsetDefault() dispatch only when canEdit=true', async () => {
    const { fixture, partitionService } = await renderPart({ canEdit: true });
    fixture.componentInstance.setDefault({ stopPropagation: () => {} }, 'p1');
    fixture.componentInstance.unsetDefault({ stopPropagation: () => {} }, 'p1');
    expect(partitionService.setDefault).toHaveBeenCalledWith('p1');
    expect(partitionService.unsetDefault).toHaveBeenCalledWith('p1');
  });

  it('setDefault() / unsetDefault() are no-ops when canEdit=false', async () => {
    const { fixture, partitionService } = await renderPart({ canEdit: false });
    fixture.componentInstance.setDefault({ stopPropagation: () => {} }, 'p1');
    fixture.componentInstance.unsetDefault({ stopPropagation: () => {} }, 'p1');
    expect(partitionService.setDefault).not.toHaveBeenCalled();
    expect(partitionService.unsetDefault).not.toHaveBeenCalled();
  });

  it('onClipboardSuccess() opens a snackbar', async () => {
    const { fixture, snackBarOpen } = await renderPart();
    fixture.componentInstance.onClipboardSuccess();
    expect(snackBarOpen).toHaveBeenCalledWith('Copied to clipboard', 'Dismiss');
  });
});
