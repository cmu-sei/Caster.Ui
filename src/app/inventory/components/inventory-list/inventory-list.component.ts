// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  InventoryCategoryDescriptor,
  InventoryCategoryState,
  InventoryItem,
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
  standalone: false,
})
export class InventoryListComponent implements OnInit {
  @Input() descriptor: InventoryCategoryDescriptor;

  public state$: Observable<InventoryCategoryState>;
  public items$: Observable<InventoryItem[]>;
  public filter$: Observable<string>;

  public expanded = false;

  constructor(
    private inventoryQuery: InventoryQuery,
    private inventoryService: InventoryService,
    private snackBar: MatSnackBar
  ) {}

  // Assigned here rather than in a later callback: under OnPush, assigning to
  // a template-bound `| async` observable after first render leaves the
  // template blank until something else triggers change detection.
  ngOnInit() {
    this.state$ = this.inventoryQuery.selectCategory(this.descriptor.category);
    this.items$ = this.inventoryQuery.selectFilteredItems(
      this.descriptor.category
    );
    this.filter$ = this.inventoryQuery.filter$;
  }

  /** Retry a transport failure for this one category. */
  retry() {
    this.inventoryService
      .load(this.descriptor.category)
      .pipe(take(1))
      .subscribe();
  }

  onClipboardSuccess() {
    this.snackBar.open('Copied to clipboard', 'Dismiss');
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
