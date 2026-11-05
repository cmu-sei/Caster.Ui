// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import {
  MatFormField,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { Observable, Subject } from 'rxjs';
import { switchMap, take, takeUntil } from 'rxjs/operators';
import {
  InventoryCategoryDescriptor,
  InventoryConnection,
  InventoryQuery,
  InventoryService,
  providerName,
} from '../../state';
import { InventoryListComponent } from '../inventory-list/inventory-list.component';

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
  imports: [
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIcon,
    MatFormField,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatSelect,
    MatOption,
    FormsModule,
    MatIconButton,
    MatTooltip,
    MatProgressSpinner,
    InventoryListComponent,
    AsyncPipe,
    DatePipe,
  ],
})
export class InventoryPanelComponent implements OnInit, OnDestroy {
  private inventoryQuery = inject(InventoryQuery);
  private inventoryService = inject(InventoryService);

  public categories$: Observable<InventoryCategoryDescriptor[]>;
  public refreshing$: Observable<boolean>;
  public lastUpdated$: Observable<string | null>;
  public connections$: Observable<InventoryConnection[]>;
  public connection$: Observable<InventoryConnection | null>;

  public expanded = false;
  public filterString = '';

  private loaded = false;
  private unsubscribe$ = new Subject<void>();

  // Observables bound with `| async` are assigned here, before first render.
  // Assigning them later (from a subscribe callback) renders blank under
  // OnPush until something else triggers change detection.
  ngOnInit() {
    this.categories$ = this.inventoryQuery.categories$;
    this.refreshing$ = this.inventoryQuery.refreshing$;
    this.lastUpdated$ = this.inventoryQuery.lastUpdated$;
    this.connections$ = this.inventoryQuery.connections$;
    this.connection$ = this.inventoryQuery.connection$;

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
    this.inventoryService
      .loadConnections()
      .pipe(
        switchMap(() => this.inventoryService.loadAll()),
        take(1)
      )
      .subscribe();
  }

  onCollapsed() {
    this.expanded = false;
  }

  refresh() {
    this.loaded = true;
    this.inventoryService.refresh().pipe(take(1)).subscribe();
  }

  selectConnection(name: string) {
    this.inventoryService.selectConnection(name).pipe(take(1)).subscribe();
  }

  /** "dev-proxmox (Proxmox)". */
  connectionLabel(connection: InventoryConnection): string {
    return `${connection.name} (${providerName(connection.provider)})`;
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
