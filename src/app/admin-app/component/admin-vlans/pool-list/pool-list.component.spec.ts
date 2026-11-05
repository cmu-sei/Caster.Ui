// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ClipboardModule } from 'ngx-clipboard';
import { Pool, VlansService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { PartitionStore } from 'src/app/vlans/state/partition/partition.store';
import { VlanStore } from 'src/app/vlans/state/vlan/vlan.store';
import { PoolListComponent } from './pool-list.component';
import { PartitionListComponent } from 'src/app/admin-app/component/admin-vlans/partition-list/partition-list.component';

@Component({ selector: 'cas-partition-list', template: '' })
class PartitionListStub {
  readonly poolId = input<string>(undefined);
  readonly canEdit = input<boolean>(undefined);
}

const pools: Pool[] = [
  { id: 'pool1', name: 'Main', isDefault: true },
  { id: 'pool2', name: 'Lab' },
];

async function renderPoolList(
  canEdit: boolean,
  { shownPools = pools, isLoading = false, confirmAnswer = true } = {},
) {
  const vlansApi = {
    createPool: vi.fn(() => of<Pool>({ id: 'pool3', name: 'New Pool' })),
    partialEditPool: vi.fn((id: string, command: { name?: string }) =>
      of<Pool>({ ...pools[0], id, name: command.name }),
    ),
    deletePool: vi.fn((_id: string) => of<unknown>(null)),
  } satisfies ApiStub<VlansService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(PoolListComponent, {
    childStubs: [{ replace: PartitionListComponent, with: PartitionListStub }],
    imports: [
      MatTableModule,
      MatSortModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatCardModule,
      MatDialogModule,
      MatFormFieldModule,
      MatInputModule,
      MatProgressSpinnerModule,
      ClipboardModule,
    ],
    providers: [
      { provide: VlansService, useValue: vlansApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { pools: shownPools, canEdit, isLoading },
  });
  /** The pool rows (not the header, detail or no-data rows), in order. */
  const poolRows = (): HTMLElement[] =>
    Array.from(
      view.fixture.nativeElement.querySelectorAll('tr.element-row'),
    ) as HTMLElement[];
  const poolNames = () =>
    poolRows().map((r) => within(r).getAllByRole('cell')[1].textContent.trim());
  const partitionLists = (): PartitionListStub[] =>
    view.fixture.debugElement
      .queryAll(By.directive(PartitionListStub))
      .map((d) => d.componentInstance);
  return {
    ...view,
    vlansApi,
    confirm,
    poolRows,
    poolNames,
    partitionLists,
    user: userEvent.setup(),
  };
}

describe('PoolListComponent', () => {
  /**
   * Verifies: the table has the actions, Pool Name, Default, Partitions and VLANs In Use columns, a row per pool, and the default pool is marked.
   * Interacts with: the mat-table columns and the isDefault icon.
   * Data: pools Main (default) and Lab; canEdit true.
   */
  it('lists the pools in a table like the other admin pages', async () => {
    const { poolRows, poolNames } = await renderPoolList(true);

    expect(
      screen
        .getAllByRole('columnheader')
        .map((h) => h.textContent.trim())
        .slice(1),
    ).toEqual(['Pool Name', 'Default', 'Partitions', 'VLANs In Use']);
    expect(poolNames()).toEqual(['Main', 'Lab']);
    expect(
      within(poolRows()[0]).getByLabelText('Contains the Default Partition'),
    ).toBeInTheDocument();
    expect(
      within(poolRows()[1]).queryByLabelText('Contains the Default Partition'),
    ).not.toBeInTheDocument();
    // A pool's ID is only an output of crucible_vlan, so it has no copy button.
    expect(
      within(poolRows()[0]).queryByRole('button', { name: /^Copy/ }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: with canEdit, Add New Pool creates a pool through the API and each row's Rename and Delete are enabled.
   * Interacts with: VlansService.createPool (stub), real PoolService.
   * Data: pools Main and Lab; canEdit true.
   */
  it('creates a pool when canEdit is true', async () => {
    const { vlansApi, poolRows, user } = await renderPoolList(true);

    expect(
      within(poolRows()[0]).getByRole('button', { name: 'Rename' }),
    ).toBeEnabled();
    expect(
      within(poolRows()[0]).getByRole('button', { name: 'Delete Main' }),
    ).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add New Pool' }));

    expect(vlansApi.createPool).toHaveBeenCalledWith({ name: 'New Pool' });
  });

  /**
   * Verifies: without canEdit Add New Pool, Rename and Delete are disabled (as on the Groups page) and nothing is created.
   * Interacts with: the [disabled]="!canEdit()" bindings.
   * Data: pools Main and Lab; canEdit false.
   */
  it('disables the pool controls when canEdit is false', async () => {
    const { vlansApi, poolRows } = await renderPoolList(false);

    expect(screen.getByRole('button', { name: 'Add New Pool' })).toBeDisabled();
    expect(
      within(poolRows()[0]).getByRole('button', { name: 'Rename' }),
    ).toBeDisabled();
    expect(
      within(poolRows()[0]).getByRole('button', { name: 'Delete Main' }),
    ).toBeDisabled();
    expect(vlansApi.createPool).not.toHaveBeenCalled();
  });

  /**
   * Verifies: About pools carries the pool documentation as its tooltip (read as its description).
   * Interacts with: MatTooltip on About pools.
   * Data: canEdit false.
   */
  it('explains pools', async () => {
    await renderPoolList(false);

    expect(
      screen.getByRole('button', { name: 'About pools' }),
    ).toHaveAccessibleDescription(/^Pools are groups of 4096 VLANs/);
  });

  /**
   * Verifies: Rename opens the shared name dialog titled "Rename <name>" without expanding the row, and Save renames the pool through the API.
   * Interacts with: the real MatDialog and NameDialogComponent, VlansService.partialEditPool (stub), real PoolService.
   * Data: pool Main; canEdit true; new name Core.
   */
  it('renames a pool', async () => {
    const { vlansApi, poolRows, partitionLists, user } =
      await renderPoolList(true);

    await user.click(
      within(poolRows()[0]).getByRole('button', { name: 'Rename' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Rename Main' }),
    ).toBeInTheDocument();
    expect(partitionLists()).toEqual([]);
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Core');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(vlansApi.partialEditPool).toHaveBeenCalledWith('pool1', {
      name: 'Core',
    });
  });

  /**
   * Verifies: Delete Main asks "Delete Pool" / "Are you sure that you want to delete <name>?", deletes the pool without force and says so in a snack bar.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), VlansService.deletePool (stub).
   * Data: pool Main; canEdit true.
   */
  it('deletes a pool after confirmation', async () => {
    const { vlansApi, confirm, poolRows, user } = await renderPoolList(true);
    const snack = vi.spyOn(MatSnackBar.prototype, 'open');

    await user.click(
      within(poolRows()[0]).getByRole('button', { name: 'Delete Main' }),
    );

    expect(confirm).toHaveBeenCalledWith({
      title: 'Delete Pool',
      message: 'Are you sure that you want to delete Main?',
      confirmText: 'Delete',
    });
    expect(vlansApi.deletePool).toHaveBeenCalledWith('pool1', { force: false });
    expect(snack).toHaveBeenCalledWith(
      'Deleted Main',
      'Dismiss',
      expect.anything(),
    );
  });

  /**
   * Verifies: clicking a pool row expands its partition list in place with the same canEdit, clicking another moves the expansion, and clicking again collapses it.
   * Interacts with: toggleExpand and the detail row's partition-list stub.
   * Data: pools Main and Lab; canEdit false.
   */
  it('expands a pool row to show its partitions', async () => {
    const { poolRows, partitionLists, user } = await renderPoolList(false);

    expect(partitionLists()).toEqual([]);
    await user.click(poolRows()[0]);
    expect(partitionLists().map((p) => p.poolId())).toEqual(['pool1']);
    expect(partitionLists()[0].canEdit()).toBe(false);
    expect(poolRows()[0]).toHaveAttribute('aria-expanded', 'true');

    await user.click(poolRows()[1]);
    expect(partitionLists().map((p) => p.poolId())).toEqual(['pool2']);

    await user.click(poolRows()[1]);
    expect(partitionLists()).toEqual([]);
  });

  /**
   * Verifies: Partitions and VLANs In Use show a dash until a pool's VLANs are in the stores, then its partition count and in-use / total VLANs.
   * Interacts with: the counts computed over VlanQuery and PartitionQuery.
   * Data: pools Main and Lab; Main has partition Range and VLANs 1 (in use) and 2; Lab has nothing loaded.
   */
  it('counts the partitions and VLANs of a loaded pool', async () => {
    const { fixture, poolRows } = await renderPoolList(true);
    const counts = (row: HTMLElement) =>
      within(row)
        .getAllByRole('cell')
        .slice(3)
        .map((c) => c.textContent.trim());

    expect(counts(poolRows()[0])).toEqual(['-', '-']);
    TestBed.inject(PartitionStore).set([
      { id: 'part1', name: 'Range', poolId: 'pool1' },
    ]);
    TestBed.inject(VlanStore).set([
      { id: 'v1', vlanId: 1, poolId: 'pool1', inUse: true },
      { id: 'v2', vlanId: 2, poolId: 'pool1', inUse: false },
    ]);
    fixture.detectChanges();

    expect(counts(poolRows()[0])).toEqual(['1', '1 / 2']);
    expect(counts(poolRows()[1])).toEqual(['-', '-']);
  });

  /**
   * Verifies: Pool Name sorts the rows, Search narrows them by name, says when nothing matches, and Clear restores them.
   * Interacts with: MatSort and the name-only filterPredicate on the data source, filterString, the matNoDataRow.
   * Data: pools Main and Lab; searches "la" then "zz".
   */
  it('sorts and filters the pools by name', async () => {
    const { poolNames, user } = await renderPoolList(true);

    await user.click(screen.getByRole('button', { name: 'Pool Name' }));
    expect(poolNames()).toEqual(['Lab', 'Main']);

    const search = screen.getByPlaceholderText('Search');
    await user.type(search, 'ma');
    expect(poolNames()).toEqual(['Main']);

    await user.type(search, 'zz');
    expect(poolNames()).toEqual([]);
    expect(
      screen.getByText('No data matching the filter "mazz"'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(poolNames()).toEqual(['Lab', 'Main']);
  });

  /**
   * Verifies: a spinner shows while the pools load, and an empty table then says there are no Pools.
   * Interacts with: the isLoading input and the matNoDataRow.
   * Data: no pools; isLoading true, then false.
   */
  it('shows a spinner while loading and an empty message after', async () => {
    const { fixture } = await renderPoolList(true, {
      shownPools: [],
      isLoading: true,
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(
      screen.queryByText('There are currently no Pools'),
    ).not.toBeInTheDocument();

    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('There are currently no Pools')).toBeVisible();
  });
});
