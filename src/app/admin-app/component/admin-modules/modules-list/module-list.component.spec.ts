// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ClipboardModule } from 'ngx-clipboard';
import { Module, ModuleSource } from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  AdminModuleListComponent,
  moduleSourceOf,
} from './module-list.component';

const local: ModuleSource = {
  name: 'local',
  provider: 'git',
  lastAttempt: '2026-10-14T12:30:00Z',
  lastSuccess: '2026-10-14T12:30:00Z',
  error: null,
};
const gitlab: ModuleSource = {
  name: 'gitlab',
  provider: 'gitlab',
  lastAttempt: '2026-10-14T13:00:00Z',
  lastSuccess: '2026-10-14T13:00:00Z',
  error: null,
};

const vmSource = 'git::https://git.example.com/org/local.git//vm?ref=v1.10.0';
const longDescription = 'A'.repeat(90);
const modules: Module[] = [
  {
    id: 'mod1',
    name: 'vm',
    path: 'local/vm',
    description: 'A vSphere virtual machine',
    versionsCount: 2,
    dateModified: '2026-10-14T12:30:00Z',
    // The API lists versions highest first.
    versions: [
      { name: 'v1.10.0', urlLink: vmSource },
      { name: 'v1.9.0', urlLink: 'old' },
    ],
  },
  {
    id: 'mod2',
    name: 'dns',
    path: 'group/dns',
    description: longDescription,
    versionsCount: 1,
    versions: [{ name: '2.0.0', urlLink: 'git::https://gitlab/dns?ref=2.0.0' }],
  },
  { id: 'mod3', name: 'empty', path: 'local/empty', versionsCount: 0 },
];

interface Options {
  canEdit?: boolean;
  confirmAnswer?: boolean;
  sources?: ModuleSource[];
  rows?: Module[];
  refreshing?: Set<string>;
}

async function renderModuleList({
  canEdit = true,
  confirmAnswer,
  sources = [local, gitlab],
  rows = modules,
  refreshing = new Set<string>(),
}: Options = {}) {
  const refresh = vi.fn<(path: string) => void>();
  const deleteModule = vi.fn<(id: string) => void>();
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(AdminModuleListComponent, {
    imports: [
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatPaginatorModule,
      MatTableModule,
      MatSortModule,
      MatTooltipModule,
      MatCardModule,
      MatProgressSpinnerModule,
      ClipboardModule,
    ],
    providers: [
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: { modules: rows, sources, isLoading: false, canEdit, refreshing },
    on: { refresh, delete: deleteModule },
  });
  return {
    ...view,
    refresh,
    deleteModule,
    confirm,
    user: userEvent.setup(),
  };
}

/** The text of each cell in a row, whitespace collapsed. */
function cells(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent.replace(/\s+/g, ' ').trim());
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(`\\b${name}\\b`) });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('moduleSourceOf', () => {
  /**
   * Verifies: a git source owns the Modules whose Path is its name or starts with its name and a slash, the longest matching name wins, and any other Module is the GitLab source's when one is configured, else no source's.
   * Interacts with: nothing; a pure function.
   * Data: sources local, local/extra and gitlab; paths in the row.
   */
  it.each([
    { path: 'local', sources: [local, gitlab], expected: 'local' },
    { path: 'local/vm', sources: [local, gitlab], expected: 'local' },
    { path: 'LOCAL/vm', sources: [local, gitlab], expected: 'local' },
    {
      path: 'local/extra/vm',
      sources: [local, { name: 'local/extra', provider: 'git' }],
      expected: 'local/extra',
    },
    { path: 'localvm/x', sources: [local, gitlab], expected: 'gitlab' },
    { path: 'group/dns', sources: [local, gitlab], expected: 'gitlab' },
    { path: 'group/dns', sources: [local], expected: null },
    { path: null, sources: [local], expected: null },
  ])('maps $path to $expected', ({ path, sources, expected }) => {
    expect(moduleSourceOf({ path }, sources)?.name ?? null).toBe(expected);
  });
});

describe('AdminModuleListComponent', () => {
  /**
   * Verifies: the page has one toolbar row (icon, Search, paginator) with no add box or Sync menu; sources are refreshed from Module Sources.
   * Interacts with: the toolbar template.
   * Data: canEdit true.
   */
  it('shows one toolbar row with Search and the paginator', async () => {
    await renderModuleList();

    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByText('Items per page:')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: /^(Sync Modules|Add New Module)$/ }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: each row shows the Module's description (cut at 80 characters, the whole text in its title), its highest version, and Last Synced in the viewer's zone; a Module with no versions shows none; there is no Source column.
   * Interacts with: the Description, Latest Version and Last Synced columns.
   * Data: TZ UTC; vm (v1.10.0 above v1.9.0), dns (a 90-character description), empty (no versions).
   */
  it("shows each Module's description, latest version and last sync", async () => {
    vi.stubEnv('TZ', 'UTC');
    await renderModuleList();

    const headers = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent.trim());
    expect(headers).not.toContain('Source');
    expect(headers).toContain('Last Synced');

    expect(cells(rowOf('vm'))).toEqual(
      expect.arrayContaining([
        'A vSphere virtual machine',
        'v1.10.0',
        'Oct 14, 2026, 12:30 PM UTC',
      ]),
    );
    const dns = within(rowOf('dns')).getAllByRole('cell');
    expect(dns[2].textContent.trim()).toBe('A'.repeat(80) + ' ...');
    expect(dns[2]).toHaveAttribute('title', longDescription);
    expect(dns[5].textContent.trim()).toBe('2.0.0');
    expect(
      within(rowOf('empty')).getAllByRole('cell')[5].textContent.trim(),
    ).toBe('');
  });

  /**
   * Verifies: Search matches the latest version and the description.
   * Interacts with: the Search box, the table's filterPredicate.
   * Data: "v1.10" matches only vm's version; "vsphere" only vm's description.
   */
  it.each(['v1.10', 'vsphere'])('searches by %s', async (term) => {
    const { user } = await renderModuleList();

    await user.type(screen.getByPlaceholderText('Search'), term);

    expect(rowOf('vm')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /\bdns\b/ })).toBeNull();
  });

  /**
   * Verifies: a git Module's Refresh emits its Path; a GitLab Module, whose project ID Caster does not keep, shows Refresh greyed out with the reason.
   * Interacts with: the actions column, canRefreshModule, the refresh output.
   * Data: vm (local/vm), dns (GitLab).
   */
  it('refreshes one git Module from its row', async () => {
    const { refresh, user } = await renderModuleList();

    await user.click(
      within(rowOf('vm')).getByRole('button', { name: 'Refresh vm' }),
    );

    expect(refresh).toHaveBeenCalledWith('local/vm');
    expect(
      within(rowOf('dns')).getByRole('button', {
        name: 'Refresh dns (not available for GitLab Modules)',
      }),
    ).toBeDisabled();
  });

  /**
   * Verifies: a row's Refresh is disabled while that Module, its source, or every source is being refreshed.
   * Interacts with: the refreshing input, isRefreshing.
   * Data: refreshing holds local/vm, local, or '*'.
   */
  it.each([['local/vm'], ['local'], ['*']])(
    'disables Refresh while %s is refreshing',
    async (key) => {
      await renderModuleList({ refreshing: new Set([key]) });

      expect(
        within(rowOf('vm')).getByRole('button', { name: 'Refresh vm' }),
      ).toBeDisabled();
    },
  );

  /**
   * Verifies: refreshing another source leaves this row's Refresh usable.
   * Interacts with: the refreshing input, isRefreshing.
   * Data: refreshing holds mirror; vm is local's.
   */
  it('leaves Refresh enabled while another source refreshes', async () => {
    await renderModuleList({ refreshing: new Set(['mirror']) });

    expect(
      within(rowOf('vm')).getByRole('button', { name: 'Refresh vm' }),
    ).toBeEnabled();
  });

  /**
   * Verifies: Copy Terraform source is offered for the latest version's module source, and a Module with no version shows the button greyed out.
   * Interacts with: the ngxClipboard button.
   * Data: vm (latest v1.10.0's urlLink), empty (no versions).
   */
  it("offers the latest version's Terraform source to copy", async () => {
    await renderModuleList();

    expect(
      within(rowOf('vm')).getByRole('button', {
        name: 'Copy the Terraform source of vm',
      }),
    ).toBeEnabled();
    expect(
      within(rowOf('empty')).getByRole('button', {
        name: 'Copy the Terraform source of empty (no version yet)',
      }),
    ).toBeDisabled();
  });

  /**
   * Verifies: once the API reports missingSince, Delete is offered only for a Module no longer in its source (marked Not in source) or a GitLab Module.
   * Interacts with: canDelete, missingSince, the Name column.
   * Data: vm in source, gone (missing since a date), dns (GitLab).
   */
  it('offers Delete only for leftover Modules once the API reports them', async () => {
    const rows = [
      { ...modules[0], missingSince: null },
      {
        id: 'mod4',
        name: 'gone',
        path: 'local/gone',
        versionsCount: 0,
        missingSince: '2026-10-15T09:00:00Z',
      },
      { ...modules[1], missingSince: null },
    ] as unknown as Module[];
    await renderModuleList({ rows });

    expect(
      within(rowOf('vm')).queryByRole('button', { name: 'Delete vm' }),
    ).toBeNull();
    expect(within(rowOf('vm')).queryByText('Not in source')).toBeNull();
    expect(within(rowOf('gone')).getByText('Not in source')).toBeVisible();
    expect(
      within(rowOf('gone')).getByRole('button', { name: 'Delete gone' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('dns')).getByRole('button', { name: 'Delete dns' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: an API that doesn't report missingSince keeps Delete on every row, as before.
   * Interacts with: canDelete.
   * Data: the modules without missingSince.
   */
  it('keeps Delete on every row for an API without missingSince', async () => {
    await renderModuleList();

    for (const name of ['vm', 'dns', 'empty']) {
      expect(
        within(rowOf(name)).getByRole('button', { name: `Delete ${name}` }),
      ).toBeInTheDocument();
    }
  });

  /**
   * Verifies: deleting a module from its row asks "Delete Module" / "Are you sure that you want to delete <name>?" and emits its id once confirmed.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), the delete output.
   * Data: module vm (mod1).
   */
  it('deletes a module after confirmation', async () => {
    const { deleteModule, confirm, user } = await renderModuleList({
      confirmAnswer: true,
    });

    await user.click(
      within(rowOf('vm')).getByRole('button', { name: 'Delete vm' }),
    );

    expect(confirm).toHaveBeenCalledWith({
      title: 'Delete Module',
      message: 'Are you sure that you want to delete vm?',
      confirmText: 'Delete',
    });
    expect(deleteModule).toHaveBeenCalledWith('mod1');
  });

  /**
   * Verifies: cancelling the confirmation deletes nothing.
   * Interacts with: CrucibleDialogService.confirm (stub answering false), the delete output.
   * Data: module vm.
   */
  it('does not delete when the confirmation is cancelled', async () => {
    const { deleteModule, user } = await renderModuleList({
      confirmAnswer: false,
    });

    await user.click(
      within(rowOf('vm')).getByRole('button', { name: 'Delete vm' }),
    );

    expect(deleteModule).not.toHaveBeenCalled();
  });

  /**
   * Verifies: without canEdit there is no Refresh or Delete in any row, while the modules are listed with their Copy Terraform source buttons.
   * Interacts with: the @if (canEdit()) blocks in the template.
   * Data: canEdit false.
   */
  it('hides Refresh and Delete when canEdit is false', async () => {
    await renderModuleList({ canEdit: false });

    expect(within(rowOf('vm')).getByText('local/vm')).toBeInTheDocument();
    expect(
      within(rowOf('vm')).getByRole('button', {
        name: 'Copy the Terraform source of vm',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^(Refresh|Delete) / }),
    ).not.toBeInTheDocument();
  });
});
