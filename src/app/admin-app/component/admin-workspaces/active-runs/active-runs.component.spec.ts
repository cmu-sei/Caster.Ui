// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import { Run, RunStatus } from 'src/app/generated/caster-api';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { CwdTableComponent } from 'src/app/sei-cwd-common/cwd-table/components/cwd-table/cwd-table.component';
import { TableItemContentDirective } from 'src/app/sei-cwd-common/cwd-table/directives/table-item-content.directive';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ActiveRunsComponent } from './active-runs.component';

@Component({ selector: 'cas-run', template: '', standalone: false })
class RunStub {
  @Input() run: Run;
  @Output() planOutput = new EventEmitter<string>();
  @Output() applyOutput = new EventEmitter<string>();
}

const runs: Run[] = [
  {
    id: 'run1',
    workspaceId: 'ws1',
    status: RunStatus.Planning,
    isDestroy: false,
    createdAt: '2026-01-02T03:04:05Z',
  },
];

describe('ActiveRunsComponent', () => {
  /**
   * Verifies: the active runs are listed, and an expanded run renders its run view.
   * Interacts with: the real cwd-table, the cas-run stub.
   * Data: one planning run run1, expanded.
   */
  it('lists the active runs and renders an expanded one', async () => {
    const { fixture } = await renderComponent(ActiveRunsComponent, {
      // The real cwd-table: an app NgModule's exports are not visible to the
      // test module, so its component and directive are declared here.
      declarations: [RunStub, CwdTableComponent, TableItemContentDirective],
      imports: [
        MatCardModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatSortModule,
      ],
      inputs: { runs, expandedRuns: ['run1'] },
    });

    expect(screen.getByRole('heading', { name: 'Active Runs' })).toBeVisible();
    expect(screen.getByText('ws1')).toBeInTheDocument();
    const run: RunStub = fixture.debugElement.query(
      By.directive(RunStub),
    ).componentInstance;
    expect(run.run.id).toBe('run1');
  });
});
