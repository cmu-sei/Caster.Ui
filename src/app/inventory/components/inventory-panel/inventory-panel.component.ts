// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  INVENTORY_CATEGORIES,
  InventoryCategoryDescriptor,
  InventoryQuery,
  InventoryService,
} from '../../state';

/**
 * Read-only infrastructure inventory for the project side panel.
 *
 * Shows what VM templates, ISOs, networks and datastores exist so a user
 * building a topology does not have to open vCenter in a second window to
 * find the names they must type into Terraform variables.
 *
 * Read-only by design. Typed variable pickers, editor autocompletion and
 * validation are tracked separately (CRU-3088) and deliberately not here.
 */
@Component({
  selector: 'cas-inventory-panel',
  templateUrl: './inventory-panel.component.html',
  styleUrls: ['./inventory-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class InventoryPanelComponent implements OnInit, OnDestroy {
  public readonly categories: InventoryCategoryDescriptor[] =
    INVENTORY_CATEGORIES;

  public refreshing$: Observable<boolean>;

  public expanded = false;
  public filterString = '';

  private loaded = false;
  private unsubscribe$ = new Subject<void>();

  constructor(
    private inventoryQuery: InventoryQuery,
    private inventoryService: InventoryService
  ) {}

  // Observables bound with `| async` are assigned here, before first render.
  // Assigning them later (from a subscribe callback) renders blank under
  // OnPush until something else triggers change detection.
  ngOnInit() {
    this.refreshing$ = this.inventoryQuery.refreshing$;

    this.inventoryQuery.filter$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((filter) => (this.filterString = filter));
  }

  /** Lazy first load: don't call vCenter until the user opens the panel. */
  onExpanded() {
    this.expanded = true;
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.inventoryService.loadAll().pipe(take(1)).subscribe();
  }

  onCollapsed() {
    this.expanded = false;
  }

  refresh() {
    this.loaded = true;
    this.inventoryService.refresh().pipe(take(1)).subscribe();
  }

  applyFilter(filter: string) {
    this.inventoryService.setFilter(filter);
  }

  clearFilter() {
    this.filterString = '';
    this.inventoryService.setFilter('');
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
