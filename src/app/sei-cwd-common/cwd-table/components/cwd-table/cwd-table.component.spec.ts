// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { renderComponent } from '../../../../test-utils/render-component';
import { CwdTableComponent } from './cwd-table.component';

interface Row {
  id: string;
  name: string;
  status: string;
}

const items: Row[] = [
  { id: 'r1', name: 'alpha', status: 'Planned' },
  { id: 'r2', name: 'bravo', status: 'Applied' },
];

async function renderTable(overrides: { loading?: boolean } = {}) {
  const expand = vi.fn<(e: { expand: boolean; item: Row }) => void>();
  const view = await renderComponent(CwdTableComponent<Row>, {
    imports: [
      MatFormFieldModule,
      MatInputModule,
      MatIconModule,
      MatButtonModule,
      MatPaginatorModule,
      MatSortModule,
      MatExpansionModule,
      MatCardModule,
      MatProgressSpinnerModule,
    ],
    inputs: {
      items,
      displayedColumns: ['name', 'status'],
      columnLabels: { name: 'Name' },
      loading: overrides.loading ?? false,
    },
    on: { expand },
  });
  return { ...view, expand, user: userEvent.setup() };
}

describe('CwdTableComponent', () => {
  /**
   * Verifies: the table shows a labelled header and one row per item, and the search box filters the rows.
   * Interacts with: the filterPredicate built in initialize().
   * Data: rows alpha (Planned) and bravo (Applied); search "brav".
   */
  it('lists the items and filters them', async () => {
    const { user } = await renderTable();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Search'), 'brav');

    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(screen.getByText('bravo')).toBeInTheDocument();
  });

  /**
   * Verifies: expanding a row emits expand with that item.
   * Interacts with: the expand output via afterExpand.
   * Data: row bravo's header clicked.
   */
  it('emits expand for an opened row', async () => {
    const { fixture, expand, user } = await renderTable();

    await user.click(screen.getByText('bravo'));
    await fixture.whenStable();

    expect(expand).toHaveBeenCalledWith({ expand: true, item: items[1] });
  });

  /**
   * Verifies: while loading the spinner shows.
   * Interacts with: the loading input.
   * Data: loading true.
   */
  it('shows a spinner while loading', async () => {
    await renderTable({ loading: true });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
