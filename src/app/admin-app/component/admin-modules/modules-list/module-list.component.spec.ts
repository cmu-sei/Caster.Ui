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
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
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
import { GitlabProjectDialogComponent } from '../gitlab-project-dialog/gitlab-project-dialog.component';
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
const mirror: ModuleSource = {
  name: 'mirror',
  provider: 'git',
  lastAttempt: '2026-10-14T13:00:00Z',
  lastSuccess: null,
  error: 'clone failed',
};
const fresh: ModuleSource = { name: 'fresh', provider: 'git' };
const gitlab: ModuleSource = {
  name: 'gitlab',
  provider: 'gitlab',
  lastAttempt: '2026-10-14T13:00:00Z',
  lastSuccess: '2026-10-14T13:00:00Z',
  error: null,
};

const modules: Module[] = [
  { id: 'mod1', name: 'vm', path: 'local/vm', versionsCount: 2 },
  { id: 'mod2', name: 'dns', path: 'group/dns', versionsCount: 1 },
];

interface Options {
  canEdit?: boolean;
  confirmAnswer?: boolean;
  sources?: ModuleSource[];
  /** What the GitLab project dialog closes with. */
  projectId?: string;
}

async function renderModuleList({
  canEdit = true,
  confirmAnswer,
  sources = [local, mirror, fresh, gitlab],
  projectId,
}: Options = {}) {
  const syncAll = vi.fn<() => void>();
  const sync = vi.fn<(id: string) => void>();
  const deleteModule = vi.fn<(id: string) => void>();
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmAnswer);
  const confirm = vi.fn(() => dialogRef);
  const { dialogRef: projectRef } = dialogRefStub<unknown, string>(projectId);
  const open = vi.fn(() => projectRef);
  const view = await renderComponent(AdminModuleListComponent, {
    imports: [
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatMenuModule,
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
      { provide: MatDialog, useValue: { open } },
    ],
    inputs: { modules, sources, isLoading: false, canEdit },
    on: { syncAll, sync, delete: deleteModule },
  });
  return {
    ...view,
    syncAll,
    sync,
    deleteModule,
    confirm,
    open,
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
   * Data: sources local, local-extra and gitlab; paths in the row.
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
   * Verifies: the page has one toolbar row (icon, Search, paginator), with no External Module ID box and no second row of buttons.
   * Interacts with: the toolbar template.
   * Data: canEdit true.
   */
  it('shows one toolbar row with Search and the paginator', async () => {
    await renderModuleList();

    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByText('Items per page:')).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('External Module ID'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  /**
   * Verifies: each row shows the Module's source in the Source column next to its Name and Path.
   * Interacts with: moduleSourceOf through ngOnChanges, the Source column.
   * Data: vm from local, dns from the GitLab source.
   */
  it('shows which source each Module comes from', async () => {
    await renderModuleList();

    expect(
      within(screen.getAllByRole('row')[0])
        .getAllByRole('columnheader')
        .map((h) => h.textContent.trim()),
    ).toEqual(['', 'Name', 'Source', 'Path', 'Versions', 'Date Loaded']);
    expect(cells(rowOf('vm')).slice(1, 4)).toEqual(['vm', 'local', 'local/vm']);
    expect(cells(rowOf('dns')).slice(1, 4)).toEqual([
      'dns',
      'gitlab',
      'group/dns',
    ]);
  });

  /**
   * Verifies: Search matches the Source column too, case-insensitively.
   * Interacts with: the Search box, the table's filterPredicate.
   * Data: "GITLAB" typed; only dns comes from gitlab.
   */
  it('searches by source', async () => {
    const { user } = await renderModuleList();

    await user.type(screen.getByPlaceholderText('Search'), 'GITLAB');

    expect(screen.queryByRole('row', { name: /\bvm\b/ })).toBeNull();
    expect(rowOf('dns')).toBeInTheDocument();
  });

  /**
   * Verifies: sorting by Source orders the rows by source name.
   * Interacts with: the Source column's mat-sort-header.
   * Data: vm (local) and dns (gitlab).
   */
  it('sorts by source', async () => {
    const { user } = await renderModuleList();

    await user.click(screen.getByRole('button', { name: 'Source' }));

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => cells(row)[1]);
    expect(names).toEqual(['dns', 'vm']);
  });

  /**
   * Verifies: the sync menu offers All sources, then each configured source with its status (last sync time in the viewer's zone, failure time, or not synced yet); All sources emits syncAll.
   * Interacts with: the header Sync Modules button and mat-menu, statusText, the syncAll output.
   * Data: TZ UTC; sources local (synced), mirror (failed), fresh (never synced), gitlab.
   */
  it('lists every source in the sync menu and syncs them all', async () => {
    vi.stubEnv('TZ', 'UTC');
    const { syncAll, user } = await renderModuleList();

    await user.click(screen.getByRole('button', { name: 'Sync Modules' }));

    expect(
      screen
        .getAllByRole('menuitem')
        .map((item) => item.textContent.replace(/\s+/g, ' ').trim()),
    ).toEqual([
      'All sources',
      'local Synced Oct 14, 2026, 12:30 PM UTC',
      'mirror Failed Oct 14, 2026, 1:00 PM UTC',
      'fresh Not synced yet',
      'gitlab (by GitLab Project ID) Synced Oct 14, 2026, 1:00 PM UTC',
    ]);

    await user.click(screen.getByRole('menuitem', { name: 'All sources' }));
    expect(syncAll).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: picking a git source in the sync menu emits its name, without asking for anything.
   * Interacts with: the sync menu, the sync output, MatDialog.open (spy).
   * Data: source mirror.
   */
  it('syncs one git source by name from the sync menu', async () => {
    const { sync, open, user } = await renderModuleList();

    await user.click(screen.getByRole('button', { name: 'Sync Modules' }));
    await user.click(screen.getByRole('menuitem', { name: /^mirror/ }));

    expect(sync).toHaveBeenCalledWith('mirror');
    expect(open).not.toHaveBeenCalled();
  });

  /**
   * Verifies: picking the GitLab source asks for a project ID and emits it; cancelling emits nothing.
   * Interacts with: the sync menu, MatDialog.open (stub closing with the ID or nothing), the sync output.
   * Data: project ID 42, or the dialog cancelled.
   */
  it.each([
    { label: 'an entered project ID', projectId: '42', calls: [['42']] },
    { label: 'nothing when cancelled', projectId: undefined, calls: [] },
  ])('syncs $label for the GitLab source', async ({ projectId, calls }) => {
    const { sync, open, user } = await renderModuleList({ projectId });

    await user.click(screen.getByRole('button', { name: 'Sync Modules' }));
    await user.click(screen.getByRole('menuitem', { name: /^gitlab/ }));

    expect(open).toHaveBeenCalledWith(GitlabProjectDialogComponent, {
      width: '400px',
    });
    expect(sync.mock.calls).toStrictEqual(calls);
  });

  /**
   * Verifies: a git Module's row syncs it by its Path; a GitLab Module, whose project ID Caster does not keep, has no per-row sync.
   * Interacts with: the actions column, canSyncModule, the sync output.
   * Data: vm (local/vm), dns (GitLab).
   */
  it('syncs one git Module from its row', async () => {
    const { sync, user } = await renderModuleList();

    await user.click(
      within(rowOf('vm')).getByRole('button', { name: 'Sync vm' }),
    );

    expect(sync).toHaveBeenCalledWith('local/vm');
    expect(
      within(rowOf('dns')).queryByRole('button', { name: 'Sync dns' }),
    ).toBeNull();
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
   * Verifies: without canEdit there is no sync menu and no per-row Sync or Delete, while the modules are listed with their Copy ID buttons.
   * Interacts with: the @if (canEdit) blocks in the template.
   * Data: canEdit false.
   */
  it('hides the sync and delete controls when canEdit is false', async () => {
    await renderModuleList({ canEdit: false });

    expect(within(rowOf('vm')).getByText('local/vm')).toBeInTheDocument();
    expect(
      within(rowOf('vm')).getByRole('button', { name: 'Copy ID of vm' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sync Modules' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^(Sync|Delete) / }),
    ).not.toBeInTheDocument();
  });
});
