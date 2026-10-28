// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { screen } from '@testing-library/angular';
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
import { TableActionDirective } from './table-action.directive';

interface Row {
  id: string;
  name: string;
  status: string;
}

// The host's template is set with overrideTemplate in each test. The host
// imports the table and directive, so the template compiles against them.
@Component({ template: '', imports: [CwdTableComponent, TableActionDirective] })
class TableHost {
  items: Row[] = [
    { id: 'r1', name: 'alpha', status: 'Planned' },
    { id: 'r2', name: 'bravo', status: 'Applied' },
  ];
  columns = ['name', 'status'];
}

/** The template the toolbar slot reads, as workspace-container.component.html uses it. */
const markedTemplate = `
  <cwd-table [items]="items" [displayedColumns]="columns" [loading]="false">
    <button *cwdTableAction type="button">Add Workspace</button>
  </cwd-table>
`;

/** The same button in an ng-template that carries no cwdTableAction. */
const unmarkedTemplate = `
  <cwd-table [items]="items" [displayedColumns]="columns" [loading]="false">
    <ng-template><button type="button">Add Workspace</button></ng-template>
  </cwd-table>
`;

async function renderHost(template: string) {
  return renderComponent(TableHost, {
    imports: [
      CwdTableComponent,
      TableActionDirective,
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

describe('TableActionDirective', () => {
  /**
   * Verifies: a cwdTableAction template is rendered once, in the table's toolbar actions, not per row.
   * Interacts with: the real CwdTableComponent (@ContentChild(TableActionDirective, { read: TemplateRef })).
   * Data: two rows; an Add Workspace button marked *cwdTableAction.
   */
  it('renders the cwdTableAction template once in the table toolbar', async () => {
    const { container } = await renderHost(markedTemplate);

    const buttons = screen.getAllByRole('button', { name: 'Add Workspace' });
    expect(buttons).toHaveLength(1);
    expect(container.querySelector('.list-actions')).toContainElement(
      buttons[0],
    );
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('bravo')).toBeInTheDocument();
  });

  /**
   * Verifies: a template without the cwdTableAction marker is not picked up by the table.
   * Interacts with: the real CwdTableComponent.
   * Data: two rows; the same button in a plain ng-template.
   */
  it('renders no toolbar action for a template without the cwdTableAction marker', async () => {
    const { container } = await renderHost(unmarkedTemplate);

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add Workspace' }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.list-actions')).toBeEmptyDOMElement();
  });
});
