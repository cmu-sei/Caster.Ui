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
import { TableItemActionDirective } from './table-item-action.directive';

interface Row {
  id: string;
  name: string;
  status: string;
}

// The host's template is set with overrideTemplate in each test. The host
// imports the table and directive, so the template compiles against them.
@Component({
  template: '',
  imports: [CwdTableComponent, TableItemActionDirective],
})
class TableHost {
  items: Row[] = [
    { id: 'r1', name: 'alpha', status: 'Planned' },
    { id: 'r2', name: 'bravo', status: 'Applied' },
  ];
  columns = ['name', 'status', 'actions'];
}

/** The template the row-action cell reads, as workspace-container.component.html uses it. */
const markedTemplate = `
  <cwd-table [items]="items" [displayedColumns]="columns" [loading]="false">
    <button *cwdTableItemAction="let item" type="button">Plan {{ item.name }}</button>
  </cwd-table>
`;

/** The same button in an ng-template that carries no cwdTableItemAction. */
const unmarkedTemplate = `
  <cwd-table [items]="items" [displayedColumns]="columns" [loading]="false">
    <ng-template let-item>
      <button type="button">Plan {{ item.name }}</button>
    </ng-template>
  </cwd-table>
`;

async function renderHost(template: string) {
  return renderComponent(TableHost, {
    imports: [
      CwdTableComponent,
      TableItemActionDirective,
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

/** The expansion-panel header of the row whose first cell shows `name`. */
function rowHeader(name: string): HTMLElement {
  const header = screen
    .getByText(name)
    .closest<HTMLElement>('mat-expansion-panel-header');
  expect(header).not.toBeNull();
  return header as HTMLElement;
}

/** The last cell of a row header: the actions column. */
function lastCell(header: HTMLElement): HTMLElement {
  const cells = header.querySelectorAll<HTMLElement>('.mat-mdc-cell');
  expect(cells).toHaveLength(3);
  return cells[cells.length - 1];
}

describe('TableItemActionDirective', () => {
  /**
   * Verifies: a cwdTableItemAction template is rendered in the last cell of every row with that row's item as its context, and not in the toolbar.
   * Interacts with: the real CwdTableComponent (@ContentChild(TableItemActionDirective, { read: TemplateRef })).
   * Data: rows alpha (Planned) and bravo (Applied); columns name, status, actions; a "Plan {{ item.name }}" button marked *cwdTableItemAction.
   */
  it('renders the cwdTableItemAction template in each row with that row as its context', async () => {
    const { container } = await renderHost(markedTemplate);

    const alpha = rowHeader('alpha');
    const bravo = rowHeader('bravo');
    expect(lastCell(alpha)).toContainElement(
      within(alpha).getByRole('button', { name: 'Plan alpha' }),
    );
    expect(within(alpha).getByText('Planned')).toBeInTheDocument();
    expect(within(alpha).queryByText('Plan bravo')).not.toBeInTheDocument();
    expect(lastCell(bravo)).toContainElement(
      within(bravo).getByRole('button', { name: 'Plan bravo' }),
    );
    expect(within(bravo).getByText('Applied')).toBeInTheDocument();
    expect(within(bravo).queryByText('Plan alpha')).not.toBeInTheDocument();
    expect(container.querySelector('.list-actions')).toBeEmptyDOMElement();
  });

  /**
   * Verifies: a row template without the cwdTableItemAction marker is not picked up by the table.
   * Interacts with: the real CwdTableComponent.
   * Data: rows alpha and bravo; the same button in a plain ng-template with let-item.
   */
  it('renders no row action for a template without the cwdTableItemAction marker', async () => {
    await renderHost(unmarkedTemplate);

    expect(within(rowHeader('alpha')).getByText('Planned')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Plan / }),
    ).not.toBeInTheDocument();
  });
});
