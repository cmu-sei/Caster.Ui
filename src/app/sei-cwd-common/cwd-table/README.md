## CWD Table

#### Description

The CWD table provides `cwd-table`, a list with a search field, sortable column headers and a paginator,
built on Angular Material. Each item is a row in an expansion panel. The host component supplies the table
actions, the actions of each row and the expanded content of each row through structural directives.

#### Dependencies

- `@angular/material` - npm
- `@angular/cdk` - npm

#### Components and directives

- `CwdTableComponent` (`cwd-table`)
- `TableActionDirective` (`*cwdTableAction`): rendered once, beside the search field and paginator
- `TableItemActionDirective` (`*cwdTableItemAction="let item"`): rendered in the last column of every row,
  with the row's item as its context
- `TableItemContentDirective` (`*cwdTableItemContent="let item"`): rendered in the body of every row's
  expansion panel, with the row's item as its context

#### Inputs

- `items`: the rows
- `displayedColumns`: the item properties shown as columns, in order. The cell of the last column shows the
  `cwdTableItemAction` template instead of a value.
- `columnLabels`: header labels keyed by column; a column without a label shows its name
- `loading`: hides the rows and shows a spinner
- `expandedItems`: the ids of the rows to show expanded
- `idPropertyName`: the item property compared with `expandedItems` (default `id`)
- `getRowStyle`: a function of the item whose result is applied with `ngClass` to the row header
- `excludedAttributes`: item properties the search ignores (the search reads every other property, including
  nested objects)
- `trackByPropertyName`: the item property used to track rows (the row index when not set)

#### Outputs

- `expand`: `{ expand: boolean; item }`, emitted when a row is expanded or collapsed

#### Implementation

The component and directives are standalone. Import the ones your component uses.

```typescript
import { CwdTableComponent } from '../sei-cwd-common/cwd-table/components/cwd-table/cwd-table.component';
import { TableActionDirective } from '../sei-cwd-common/cwd-table/directives/table-action.directive';
import { TableItemActionDirective } from '../sei-cwd-common/cwd-table/directives/table-item-action.directive';
import { TableItemContentDirective } from '../sei-cwd-common/cwd-table/directives/table-item-content.directive';

@Component({
  selector: 'cas-workspace-container',
  templateUrl: './workspace-container.component.html',
  imports: [CwdTableComponent, TableActionDirective, TableItemActionDirective, TableItemContentDirective],
})
export class WorkspaceContainerComponent {}
```

#### Example

```html
<cwd-table
  [items]="runs"
  [loading]="loading"
  [displayedColumns]="['createdAt', 'status', 'actions']"
  [columnLabels]="{ createdAt: 'Created At', status: 'Status', actions: 'Actions' }"
  [expandedItems]="expandedRunIds"
  [trackByPropertyName]="'id'"
  (expand)="expandRun($event)"
>
  <button *cwdTableAction mat-flat-button (click)="plan()">Plan</button>

  <button *cwdTableItemAction="let item" mat-icon-button (click)="cancel(item)">
    <mat-icon fontIcon="mdi-cancel"></mat-icon>
  </button>

  <div *cwdTableItemContent="let item">
    <cas-run [run]="item"></cas-run>
  </div>
</cwd-table>
```
