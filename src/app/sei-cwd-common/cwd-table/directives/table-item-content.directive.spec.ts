// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { screen, within } from '@testing-library/angular';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { renderComponent } from '../../../test-utils/render-component';
import { CwdTableComponent } from '../components/cwd-table/cwd-table.component';
import { TableItemContentDirective } from './table-item-content.directive';

interface Row {
  id: string;
  name: string;
  status: string;
}

// The host's template is set with overrideTemplate in each test. The host
// imports the table and directive, so the template compiles against them.
@Component({
  template: '',
  imports: [CwdTableComponent, TableItemContentDirective],
})
class TableHost {
  items: Row[] = [
    { id: 'r1', name: 'alpha', status: 'Planned' },
    { id: 'r2', name: 'bravo', status: 'Applied' },
  ];
  columns = ['name', 'status'];
  expanded = ['r1'];
}

/** The template the panel body reads, as active-runs.component.html uses it. */
const markedTemplate = `
  <cwd-table
    [items]="items"
    [displayedColumns]="columns"
    [expandedItems]="expanded"
    [loading]="false"
  >
    <p *cwdTableItemContent="let item">Details of {{ item.name }}</p>
  </cwd-table>
`;

/** The same content in an ng-template that carries no cwdTableItemContent. */
const unmarkedTemplate = `
  <cwd-table
    [items]="items"
    [displayedColumns]="columns"
    [expandedItems]="expanded"
    [loading]="false"
  >
    <ng-template let-item><p>Details of {{ item.name }}</p></ng-template>
  </cwd-table>
`;

async function renderHost(template: string) {
  return renderComponent(TableHost, {
    imports: [
      CwdTableComponent,
      TableItemContentDirective,
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
    configureTestBed: (testBed) =>
      testBed.overrideTemplate(TableHost, template),
  });
}

/** The expansion panel of the row whose first cell shows `name`. */
function rowPanel(name: string): HTMLElement {
  const panel = screen
    .getByText(name)
    .closest<HTMLElement>('mat-expansion-panel');
  expect(panel).not.toBeNull();
  return panel as HTMLElement;
}

describe('TableItemContentDirective', () => {
  /**
   * Verifies: a cwdTableItemContent template is rendered in every row's panel body with that row's item as its context, outside the row header, and shown in the expanded row.
   * Interacts with: the real CwdTableComponent (@ContentChild(TableItemContentDirective, { read: TemplateRef })), MatExpansionPanel.
   * Data: rows alpha (expanded) and bravo; a "Details of {{ item.name }}" paragraph marked *cwdTableItemContent.
   */
  it('renders the cwdTableItemContent template in each row panel with that row as its context', async () => {
    await renderHost(markedTemplate);

    const region = screen.getByRole('region');
    expect(within(region).getByText('Details of alpha')).toBeVisible();
    expect(
      within(region).queryByText('Details of bravo'),
    ).not.toBeInTheDocument();
    const alpha = rowPanel('alpha');
    const bravo = rowPanel('bravo');
    expect(alpha).toContainElement(region);
    expect(within(bravo).getByText('Details of bravo')).toBeInTheDocument();
    expect(
      within(bravo).queryByText('Details of alpha'),
    ).not.toBeInTheDocument();
    const alphaHeader = alpha.querySelector('mat-expansion-panel-header');
    expect(alphaHeader).not.toContainElement(
      within(alpha).getByText('Details of alpha'),
    );
  });

  /**
   * Verifies: a row template without the cwdTableItemContent marker is not picked up by the table.
   * Interacts with: the real CwdTableComponent.
   * Data: rows alpha (expanded) and bravo; the same paragraph in a plain ng-template with let-item.
   */
  it('renders no row content for a template without the cwdTableItemContent marker', async () => {
    await renderHost(unmarkedTemplate);

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.queryByText(/^Details of/)).not.toBeInTheDocument();
  });
});
