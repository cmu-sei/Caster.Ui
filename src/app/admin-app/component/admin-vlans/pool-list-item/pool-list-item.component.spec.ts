// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Pool, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PoolListItemComponent } from './pool-list-item.component';

const pool: Pool = { id: 'pool1', name: 'Main', isDefault: true };

async function renderItem(canEdit: boolean, confirmAnswer?: boolean) {
  const vlansApi = {
    partialEditPool: vi.fn((id: string, command: { name?: string }) =>
      of<Pool>({ ...pool, id, name: command.name }),
    ),
    deletePool: vi.fn((_id: string) => of<unknown>(null)),
  } satisfies ApiStub<VlansService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const poolSelected = vi.fn<(p: Pool) => void>();
  const view = await renderComponent(PoolListItemComponent, {
    imports: [
      MatCardModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatFormFieldModule,
      MatInputModule,
    ],
    providers: [
      { provide: VlansService, useValue: vlansApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { pool, canEdit },
    on: { poolSelected },
  });
  return { ...view, vlansApi, poolSelected, user: userEvent.setup() };
}

describe('PoolListItemComponent', () => {
  /**
   * Verifies: with canEdit, Edit Name opens an input whose Enter renames the pool through the API.
   * Interacts with: VlansService.partialEditPool (stub), real PoolService.
   * Data: pool Main; canEdit true; new name Core.
   */
  it('renames the pool when canEdit is true', async () => {
    const { vlansApi, user } = await renderItem(true);

    await user.click(screen.getByRole('button', { name: 'Edit Name' }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Core{Enter}');

    expect(vlansApi.partialEditPool).toHaveBeenCalledWith('pool1', {
      name: 'Core',
    });
  });

  /**
   * Verifies: with canEdit, Delete asks for confirmation and deletes the pool without force.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), VlansService.deletePool (stub).
   * Data: pool Main; canEdit true.
   */
  it('deletes the pool after confirmation when canEdit is true', async () => {
    const { vlansApi, user } = await renderItem(true, true);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(vlansApi.deletePool).toHaveBeenCalledWith('pool1', { force: false });
  });

  /**
   * Verifies: without canEdit neither Edit Name nor Delete renders, while Open still selects the pool.
   * Interacts with: the @if (canEdit) blocks, the poolSelected output.
   * Data: pool Main; canEdit false.
   */
  it('offers only Open when canEdit is false', async () => {
    const { poolSelected, user } = await renderItem(false);

    expect(
      screen.queryByRole('button', { name: 'Edit Name' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(poolSelected).toHaveBeenCalledWith(pool);
  });
});
