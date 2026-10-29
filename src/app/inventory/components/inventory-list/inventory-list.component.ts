// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { AsyncPipe, formatDate } from '@angular/common';
import { MatIconButton } from '@angular/material/button';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatList, MatListItem } from '@angular/material/list';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  InventoryCategoryDescriptor,
  InventoryCategoryState,
  InventoryItem,
  inventoryItemLabel,
  InventoryQuery,
  InventoryService,
} from '../../state';

/**
 * One collapsible category of the infrastructure inventory. Each instance
 * renders its own loading / unavailable / empty / list state so a single
 * unavailable category (ISOs, typically) cannot blank out the others.
 */
@Component({
  selector: 'cas-inventory-list',
  templateUrl: './inventory-list.component.html',
  styleUrls: ['./inventory-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIcon,
    MatTooltip,
    MatProgressSpinner,
    MatList,
    MatListItem,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    ClipboardModule,
    AsyncPipe,
  ],
})
export class InventoryListComponent implements OnInit {
  private inventoryQuery = inject(InventoryQuery);
  private inventoryService = inject(InventoryService);
  private snackBar = inject(MatSnackBar);
  private locale = inject(LOCALE_ID);

  readonly descriptor = input<InventoryCategoryDescriptor>(undefined);

  public state$: Observable<InventoryCategoryState>;
  public items$: Observable<InventoryItem[]>;
  public filter$: Observable<string>;

  public expanded = false;

  // Assigned here rather than in a later callback: under OnPush, assigning to
  // a template-bound `| async` observable after first render leaves the
  // template blank until something else triggers change detection.
  ngOnInit() {
    this.state$ = this.inventoryQuery.selectCategory(
      this.descriptor().category,
    );
    this.items$ = this.inventoryQuery.selectFilteredItems(
      this.descriptor().category
    );
    this.filter$ = this.inventoryQuery.filter$;
  }

  /** Retry a transport failure for this one category. */
  retry() {
    this.inventoryService
      .load(this.descriptor().category)
      .pipe(take(1))
      .subscribe();
  }

  onClipboardSuccess(name: string) {
    this.snackBar.open(`Copied ${name} to clipboard`, 'Dismiss');
  }

  /**
   * Says the list is kept from an earlier read, from when, and why the latest
   * read failed. The time matches the panel's "Updated" line.
   */
  staleMessage(state: InventoryCategoryState): string {
    const when = state.lastUpdated
      ? ` from ${formatDate(state.lastUpdated, 'short', this.locale)}`
      : '';
    const why = state.error ? ` ${state.error}` : '';
    return `Could not refresh. Showing the list${when}.${why}`;
  }

  /**
   * The item's Terraform, one entry per provider in provider order, or null
   * when it has none.
   */
  terraformOf(
    item: InventoryItem
  ): { provider: string; snippet: string }[] | null {
    const snippets = Object.entries(item.terraform ?? {})
      .filter(([, snippet]) => !!snippet)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, snippet]) => ({ provider, snippet }));
    return snippets.length ? snippets : null;
  }

  itemLabel(item: InventoryItem): string | null {
    return inventoryItemLabel(item);
  }

  /**
   * Flattens an item's path and extra properties into a tooltip. Joined with
   * a separator rather than newlines because Material renders tooltips in the
   * CDK overlay, where this component's styles cannot reach them.
   */
  propertiesTooltip(item: InventoryItem): string {
    const parts = Object.keys(item.properties || {})
      .sort()
      .map((key) => `${key}: ${item.properties[key]}`);

    if (item.path) {
      parts.unshift(item.path);
    }

    return parts.join(' · ');
  }
}
