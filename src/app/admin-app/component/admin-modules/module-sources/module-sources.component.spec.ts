// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ModuleSource } from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { GitlabProjectDialogComponent } from '../gitlab-project-dialog/gitlab-project-dialog.component';
import { ModuleSourcesComponent } from './module-sources.component';

const local = {
  name: 'local',
  provider: 'git',
  description: 'Our modules',
  lastAttempt: '2026-10-14T12:30:00Z',
  lastSuccess: '2026-10-14T12:30:00Z',
  error: null,
  url: 'https://git.example.com/org/local.git',
} as ModuleSource;
const mirror: ModuleSource = {
  name: 'mirror',
  provider: 'git',
  lastAttempt: '2026-10-14T13:00:00Z',
  lastSuccess: '2026-10-14T12:30:00Z',
  error: 'clone failed.',
};
const fresh: ModuleSource = { name: 'fresh', provider: 'git' };
const empty = {
  name: 'blank',
  provider: 'git',
  state: 'Empty',
  message: 'No tagged Modules in blank.',
} as ModuleSource;
const untagged = {
  name: 'untagged',
  provider: 'git',
  state: 'Warning',
  message: 'vm has no version tags.',
} as ModuleSource;
const gitlab: ModuleSource = {
  name: 'gitlab',
  provider: 'gitlab',
  lastSuccess: '2026-10-14T13:00:00Z',
  error: null,
};

interface Options {
  sources?: ModuleSource[];
  listed?: boolean;
  canEdit?: boolean;
  refreshing?: Set<string>;
  projectId?: string;
}

async function renderSources({
  sources = [local, mirror, fresh, empty, untagged, gitlab],
  listed = true,
  canEdit = true,
  refreshing = new Set<string>(),
  projectId,
}: Options = {}) {
  const refresh = vi.fn<(id: string) => void>();
  const refreshAll = vi.fn<() => void>();
  const { dialogRef } = dialogRefStub<unknown, string>(projectId);
  const open = vi.fn(() => dialogRef);
  const view = await renderComponent(ModuleSourcesComponent, {
    imports: [
      MatExpansionModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
    ],
    providers: [{ provide: MatDialog, useValue: { open } }],
    inputs: { sources, listed, canEdit, refreshing },
    on: { refresh, refreshAll },
  });
  return { ...view, refresh, refreshAll, open, user: userEvent.setup() };
}

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('li')!;
}

function text(element: HTMLElement): string {
  return element.textContent.replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ModuleSourcesComponent', () => {
  /**
   * Verifies: each source's row says how its last read went: updated time in the viewer's zone, the error (with the time of the Modules still shown), not read yet, the API's Empty or Warning message; each status icon is labelled.
   * Interacts with: status(), STATUS_LABELS, the source list template.
   * Data: TZ UTC; local ok, mirror failed after an earlier success, fresh never read, blank Empty, untagged Warning.
   */
  it('shows how each source was last read', async () => {
    vi.stubEnv('TZ', 'UTC');
    await renderSources();

    expect(text(rowOf('local'))).toContain('Our modules');
    expect(text(rowOf('local'))).toContain(
      'Updated Oct 14, 2026, 12:30 PM UTC',
    );
    expect(text(rowOf('mirror'))).toContain(
      'clone failed. Showing its Modules from Oct 14, 2026, 12:30 PM UTC.',
    );
    expect(text(rowOf('fresh'))).toContain('Not read yet');
    expect(text(rowOf('blank'))).toContain('No tagged Modules in blank.');
    expect(text(rowOf('untagged'))).toContain('vm has no version tags.');

    expect(
      within(rowOf('local')).getByRole('img', { name: 'Read successfully' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('mirror')).getByRole('img', { name: "Couldn't be read" }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('fresh')).getByRole('img', { name: 'Not read yet' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('blank')).getByRole('img', { name: 'No Modules yet' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('untagged')).getByRole('img', { name: 'Needs attention' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the panel header counts the sources that need attention (failed or Warning) and opens itself when there are any; with none it says how many are configured and stays closed.
   * Interacts with: failing(), the expansion panel header.
   * Data: the six sources (mirror and untagged need attention); local and gitlab only.
   */
  it('counts the sources that need attention and opens for them', async () => {
    await renderSources();

    const header = screen.getByRole('button', { name: /^Module Sources/ });
    expect(text(header)).toContain('2 of 6 need attention');
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('says how many sources are configured when all are fine', async () => {
    await renderSources({ sources: [local, gitlab] });

    const header = screen.getByRole('button', { name: /^Module Sources/ });
    expect(text(header)).toContain('2 configured');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * Verifies: with no sources the panel says none are configured, and when the API can't list them it says so instead; neither offers Refresh All.
   * Interacts with: the listed and sources inputs.
   * Data: sources []; listed false.
   */
  it.each([
    {
      listed: true,
      message: 'No module sources are configured',
    },
    {
      listed: false,
      message: "This Caster API doesn't report its module sources.",
    },
  ])('explains an empty list (listed $listed)', async ({ listed, message }) => {
    await renderSources({ sources: [], listed });

    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Refresh All Sources' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: Refresh All Sources emits refreshAll, and a git source's Refresh emits its name.
   * Interacts with: the refreshAll and refresh outputs.
   * Data: source local.
   */
  it('refreshes every source or one by name', async () => {
    const { refresh, refreshAll, user } = await renderSources();

    await user.click(
      screen.getByRole('button', { name: 'Refresh All Sources' }),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh local' }));

    expect(refreshAll).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('local');
  });

  /**
   * Verifies: a source's Refresh is disabled while it or every source is refreshing, and only its own.
   * Interacts with: the refreshing input, isRefreshing.
   * Data: refreshing holds local, or '*'.
   */
  it('disables Refresh only for the source being refreshed', async () => {
    await renderSources({ refreshing: new Set(['local']) });

    expect(
      screen.getByRole('button', { name: 'Refresh local' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Refresh mirror' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Refresh All Sources' }),
    ).toBeEnabled();
  });

  it('disables every Refresh while all sources refresh', async () => {
    await renderSources({ refreshing: new Set(['*']) });

    expect(
      screen.getByRole('button', { name: 'Refresh All Sources' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Refresh mirror' }),
    ).toBeDisabled();
  });

  /**
   * Verifies: the GitLab source has Add a GitLab Project instead of Refresh, which asks for a project ID and emits it; cancelling emits nothing.
   * Interacts with: MatDialog.open (stub closing with the ID or nothing), the refresh output.
   * Data: project ID 42, or the dialog cancelled.
   */
  it.each([
    { label: 'an entered project ID', projectId: '42', calls: [['42']] },
    { label: 'nothing when cancelled', projectId: undefined, calls: [] },
  ])('adds $label from the GitLab source', async ({ projectId, calls }) => {
    const { refresh, open, user } = await renderSources({ projectId });

    expect(
      screen.queryByRole('button', { name: 'Refresh gitlab' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Add a GitLab Project' }),
    );

    expect(open).toHaveBeenCalledWith(GitlabProjectDialogComponent, {
      width: '400px',
    });
    expect(refresh.mock.calls).toStrictEqual(calls);
  });

  /**
   * Verifies: a source whose URL the API reports has a Copy repository URL button; one without has none.
   * Interacts with: repositoryUrl(), the ngxClipboard button.
   * Data: local with a url, mirror without.
   */
  it('offers the repository URL to copy when the API reports it', async () => {
    await renderSources();

    expect(
      screen.getByRole('button', { name: 'Copy the local repository URL' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy the mirror repository URL' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: without canEdit there is no Refresh All, Refresh or Add a GitLab Project, while the statuses and Copy repository URL stay.
   * Interacts with: the @if (canEdit()) blocks.
   * Data: canEdit false.
   */
  it('hides Refresh and Add without canEdit', async () => {
    await renderSources({ canEdit: false });

    expect(
      screen.queryByRole('button', { name: /^Refresh|Add a GitLab Project/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy the local repository URL' }),
    ).toBeInTheDocument();
    expect(text(rowOf('fresh'))).toContain('Not read yet');
  });
});
