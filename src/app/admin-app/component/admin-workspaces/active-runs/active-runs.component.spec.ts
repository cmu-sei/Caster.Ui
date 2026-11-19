// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Run, RunStatus } from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  ActiveRunsComponent,
  RunWorkspace,
  formatStarted,
  toRunRow,
} from './active-runs.component';
import { RunComponent } from 'src/app/workspace/components/run/run.component';

@Component({ selector: 'cas-run', template: '' })
class RunStub {
  readonly run = input<Run>(undefined);
  readonly planOutput = output<string>();
  readonly applyOutput = output<string>();
}

const runs: Run[] = [
  {
    id: 'run1',
    workspaceId: 'ws1',
    status: RunStatus.Planning,
    isDestroy: false,
    createdAt: '2026-01-02T03:04:05Z',
    createdBy: 'Ada',
  },
  {
    id: 'run2',
    workspaceId: 'ws2',
    status: RunStatus.Queued,
    displayStatus: 'Queued (Position 2)',
    isDestroy: true,
    createdAt: '2026-01-02T04:04:05Z',
    createdBy: 'Grace',
  },
];

const workspaces: Record<string, RunWorkspace | null> = {
  ws1: { name: 'Range', projectId: 'p1', projectName: 'Exercise' },
  ws2: null,
};

async function renderActiveRuns(
  inputs: Partial<{
    runs: Run[];
    expandedRuns: string[];
    workspaces: Record<string, RunWorkspace | null>;
    loading: boolean;
  }> = {},
) {
  const expandRun = vi.fn();
  const view = await renderComponent(ActiveRunsComponent, {
    childStubs: [{ replace: RunComponent, with: RunStub }],
    inputs: {
      runs,
      expandedRuns: [],
      workspaces,
      loading: false,
      ...inputs,
    },
    on: { expandRun },
  });
  return { ...view, expandRun };
}

describe('ActiveRunsComponent', () => {
  /**
   * Verifies: each active run is a table row with its Workspace and Project names, plain-word type and status, who started it and the local start time, and no raw IDs.
   * Interacts with: the real mat-table, toRunRow.
   * Data: run1 planning in Range/Exercise; run2 a queued destroy, second in line, in a Workspace the viewer can't read.
   */
  it('lists the active runs by name in plain words', async () => {
    await renderActiveRuns();

    const range = screen.getByRole('row', { name: /Range/ });
    expect(within(range).getByText('Exercise')).toBeInTheDocument();
    expect(within(range).getByText('Plan')).toBeInTheDocument();
    expect(within(range).getByText('Planning')).toBeInTheDocument();
    expect(within(range).getByText('Ada')).toBeInTheDocument();
    expect(
      within(range).getByText(formatStarted('2026-01-02T03:04:05Z')),
    ).toBeInTheDocument();
    const hidden = screen.getByRole('row', { name: /can't view/ });
    expect(within(hidden).getByText('Destroy')).toBeInTheDocument();
    expect(
      within(hidden).getByText('Queued, number 2 in line'),
    ).toBeInTheDocument();
    expect(screen.queryByText('ws1')).toBeNull();
  });

  /**
   * Verifies: Open links to the Workspace in its Project, and is shown disabled when the viewer can't read the Project.
   * Interacts with: the actions column (routerLink).
   * Data: run1 in Project p1; run2 in an unreadable Workspace.
   */
  it('links to the Workspace, or shows Open disabled', async () => {
    await renderActiveRuns();

    const open = screen.getByRole('link', { name: 'Open Range' });
    expect(open.getAttribute('href')).toBe('/projects/p1?workspace=ws1');
    expect(
      screen.getByRole('button', {
        name: "Open Workspace you can't view (not available)",
      }),
    ).toBeDisabled();
  });

  /**
   * Verifies: clicking a run's row asks to expand it, as on the other admin tables; there is no expand arrow.
   * Interacts with: the row click, the expandRun output.
   * Data: run1 collapsed.
   */
  it('asks to expand a run when its row is clicked', async () => {
    const { expandRun } = await renderActiveRuns();

    await userEvent.setup().click(screen.getByRole('cell', { name: 'Range' }));
    expect(expandRun).toHaveBeenCalledWith({ expand: true, item: runs[0] });
    expect(
      screen.queryByRole('button', { name: /Show Output|Hide Output/ }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: an expanded run renders its run view.
   * Interacts with: the cas-run stub.
   * Data: run1 expanded.
   */
  it('shows the output of an expanded run', async () => {
    const { fixture } = await renderActiveRuns({ expandedRuns: ['run1'] });

    const run: RunStub = fixture.debugElement.query(
      By.directive(RunStub),
    ).componentInstance;
    expect(run.run().id).toBe('run1');
  });

  /**
   * Verifies: Search narrows the rows by Workspace, Project, status or who started the run, and says when nothing matches.
   * Interacts with: the Search box and the table's filter.
   * Data: the two runs; searches "grace" then "nothing".
   */
  it('filters the runs from the Search box', async () => {
    await renderActiveRuns();
    const user = userEvent.setup();
    const search = screen.getByRole('textbox', { name: 'Search' });

    await user.type(search, 'grace');
    expect(screen.queryByRole('row', { name: /Range/ })).toBeNull();
    expect(screen.getByRole('row', { name: /Grace/ })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'nothing');
    expect(
      screen.getByText('No active runs match "nothing"'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: with no active runs the table says so in plain words.
   * Interacts with: the table's no-data row.
   * Data: no runs, not loading.
   */
  it('says when no runs are active', async () => {
    await renderActiveRuns({ runs: [] });

    expect(
      screen.getByText('No runs are queued, planning or applying right now'),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a run whose Workspace is still being looked up says so, and an unknown status shows as the API sends it.
   * Interacts with: toRunRow.
   * Data: an Applying run with no lookup yet; an Applied run.
   */
  it('names runs still being looked up', () => {
    expect(
      toRunRow({ id: 'r', status: RunStatus.Applying }, undefined),
    ).toMatchObject({ workspaceName: 'Loading...', status: 'Applying' });
    expect(toRunRow({ id: 'r', status: RunStatus.Applied }, null).status).toBe(
      'Applied',
    );
  });
});
