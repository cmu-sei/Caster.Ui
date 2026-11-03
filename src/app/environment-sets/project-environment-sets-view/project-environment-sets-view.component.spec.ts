// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  EnvironmentSetsService,
  ProjectEnvironmentSet,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { EnvironmentSetService } from '../environment-set.service';
import { ProjectEnvironmentSetsViewComponent } from './project-environment-sets-view.component';

function set(
  id: string,
  name: string,
  overrides: Partial<ProjectEnvironmentSet> = {},
): ProjectEnvironmentSet {
  return {
    environmentSetId: id,
    projectId: 'p1',
    name,
    isComplete: true,
    entries: [],
    ...overrides,
  };
}

const proxmox = set('s1', 'Proxmox', {
  description: 'Lab Proxmox',
  entries: [
    {
      id: 'e1',
      kind: 'EnvironmentVariable',
      targetName: 'PROXMOX_VE_API_TOKEN',
      valueSource: 'Secret',
      value: null,
      isAvailable: true,
    },
    {
      id: 'e2',
      kind: 'TerraformVariable',
      targetName: 'node',
      valueSource: 'Plain',
      value: 'pve1',
      isAvailable: true,
    },
  ],
});

async function renderView(
  sets: ProjectEnvironmentSet[],
  inputs: { compact?: boolean; canInsert?: boolean } = {},
) {
  const copy = vi.fn(() => true);
  const insert = vi.fn();
  const view = await renderComponent(ProjectEnvironmentSetsViewComponent, {
    inputs: { projectId: 'p1', ...inputs },
    on: { insert },
    providers: [
      {
        provide: EnvironmentSetsService,
        useValue: {
          getProjectEnvironmentSets: vi.fn(() => of(structuredClone(sets))),
        } satisfies ApiStub<EnvironmentSetsService>,
      },
      { provide: Clipboard, useValue: { copy } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ],
  });

  return { ...view, copy, insert, user: userEvent.setup() };
}

describe('ProjectEnvironmentSetsViewComponent', () => {
  /**
   * Verifies: each set is its own panel, a Terraform variable is labelled var.<name>, a secret shows only its status, and a plain value shows.
   * Interacts with: getProjectEnvironmentSets (stub), real EnvironmentSetService.
   * Data: Proxmox with a secret env var and a plain Terraform variable.
   */
  it('shows each set as a panel with its variables', async () => {
    await renderView([proxmox]);

    expect(screen.getByText('Proxmox')).toBeInTheDocument();
    expect(screen.getByText('Lab Proxmox')).toBeInTheDocument();
    expect(screen.getByText('PROXMOX_VE_API_TOKEN')).toBeInTheDocument();
    expect(screen.getByText('var.node')).toBeInTheDocument();
    expect(screen.getByText('pve1')).toBeInTheDocument();
    expect(screen.getByText(/Secret · available/)).toBeInTheDocument();
  });

  /**
   * Verifies: with more than three sets, complete ones start collapsed and incomplete ones expanded.
   * Interacts with: the expansion panels' aria-expanded state.
   * Data: four sets, the last incomplete.
   */
  it('collapses complete sets when there are many', async () => {
    await renderView([
      set('a', 'A'),
      set('b', 'B'),
      set('c', 'C'),
      set('d', 'D', { isComplete: false }),
    ]);

    const header = (name: string) =>
      screen.getByText(name).closest('mat-expansion-panel-header');
    expect(header('A')).toHaveAttribute('aria-expanded', 'false');
    expect(header('D')).toHaveAttribute('aria-expanded', 'true');
  });

  /**
   * Verifies: the filter hides sets with no match.
   * Interacts with: the Filter input.
   * Data: Proxmox and an empty AWS set; filter "node".
   */
  it('filters variables across sets', async () => {
    const { user } = await renderView([proxmox, set('s2', 'AWS')]);

    await user.type(screen.getByLabelText('Filter'), 'node');

    expect(screen.getByText('var.node')).toBeInTheDocument();
    expect(screen.queryByText('PROXMOX_VE_API_TOKEN')).toBeNull();
    expect(screen.queryByText('AWS')).toBeNull();
  });

  /**
   * Verifies: Copy on a Terraform variable copies its declaration, on an environment variable its name.
   * Interacts with: Clipboard.copy (stub).
   * Data: Proxmox's two entries.
   */
  it('copies a declaration or a name', async () => {
    const { user, copy } = await renderView([proxmox]);

    await user.click(
      screen.getByRole('button', { name: 'Copy the declaration of var.node' }),
    );
    expect(copy).toHaveBeenLastCalledWith(
      expect.stringContaining('variable "node" {'),
    );

    await user.click(
      screen.getByRole('button', { name: /^Copy PROXMOX_VE_API_TOKEN/ }),
    );
    expect(copy).toHaveBeenLastCalledWith('PROXMOX_VE_API_TOKEN');
  });

  /**
   * Verifies: Insert is offered only when inserting is allowed, and only for entries that need a declaration.
   * Interacts with: the insert output.
   * Data: Proxmox, compact, with and without canInsert.
   */
  it('offers Insert only in the editor while editing', async () => {
    const { user, insert } = await renderView([proxmox], {
      compact: true,
      canInsert: true,
    });

    expect(
      screen.queryByRole('button', {
        name: 'Insert the declaration of var.PROXMOX_VE_API_TOKEN',
      }),
    ).toBeNull();
    await user.click(
      screen.getByRole('button', {
        name: 'Insert the declaration of var.node',
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.stringContaining('variable "node" {'),
    );
  });

  /**
   * Verifies: a SignalR update reaches the open view.
   * Interacts with: EnvironmentSetService.projectSetsUpdated (real).
   * Data: no sets at first; Proxmox assigned while open.
   */
  it('updates live when a set is assigned', async () => {
    const { fixture } = await renderView([]);
    expect(
      screen.getByText('No Environment Sets are assigned to this project.'),
    ).toBeInTheDocument();

    TestBed.inject(EnvironmentSetService).projectSetsUpdated('p1', [proxmox]);
    fixture.detectChanges();

    expect(screen.getByText('var.node')).toBeInTheDocument();
  });
});
