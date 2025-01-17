// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  EventEmitter,
  OnInit,
  ViewChild,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ConfirmDialogComponent } from 'src/app/sei-cwd-common/confirm-dialog/components/confirm-dialog.component';
import { HttpEventType } from '@angular/common/http';
import { Module } from '../../../../generated/caster-api';
import { Subject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  fromMatSort,
  sortRows,
  fromMatPaginator,
  paginateRows,
} from 'src/app/datasource-utils';

const WAS_CANCELLED = 'wasCancelled';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'cas-admin-module-list',
  templateUrl: './module-list.component.html',
  styleUrls: ['./module-list.component.css'],
})
export class AdminModuleListComponent implements OnInit, OnChanges {
  public displayedColumns: string[] = ['name', 'path', 'dateModified'];
  public filterString = '';
  public savedFilterString = '';
  public moduleDataSource = new MatTableDataSource<Module>(new Array<Module>());
  public externalModuleId = '';

  // MatPaginator Output
  public defaultPageSize = 10;
  public pageEvent: PageEvent;
  displayedRows$: Observable<Module[]>;
  totalRows$: Observable<number>;
  sortEvents$: Observable<Sort>;
  pageEvents$: Observable<PageEvent>;

  @Input() modules: Module[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() load: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() loadModuleById: EventEmitter<string> = new EventEmitter<string>();
  @Output() delete: EventEmitter<string> = new EventEmitter<string>();
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(private dialog: MatDialog) {}

  /**
   * Initialization
   */
  ngOnInit() {
    this.sortEvents$ = fromMatSort(this.sort);
    this.pageEvents$ = fromMatPaginator(this.paginator);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!!changes.modules && !!changes.modules.currentValue) {
      this.moduleDataSource.data = changes.modules.currentValue;
      this.filterAndSort(this.filterString);
    }
  }

  /**
   * Called by UI to add a filter to the moduleDataSource
   * @param filterValue
   */
  applyFilter(filterValue: string) {
    this.filterString = filterValue.toLowerCase();
    this.filterAndSort(this.filterString);
  }

  /**
   * Clears the search string
   */
  clearFilter() {
    this.applyFilter('');
  }

  /**
   * filters and sorts the displayed rows
   */
  filterAndSort(filterValue: string) {
    this.moduleDataSource.filter = filterValue;
    const rows$ = of(this.moduleDataSource.filteredData);
    this.totalRows$ = rows$.pipe(map((rows) => rows.length));
    if (!!this.sortEvents$ && !!this.pageEvents$) {
      this.displayedRows$ = rows$.pipe(
        sortRows(this.sortEvents$),
        paginateRows(this.pageEvents$)
      );
    }
  }

  /**
   * Adds all available modules
   */
  updateAllModules() {
    this.load.emit(true);
  }

  /**
   * Adds a new module
   */
  updateModuleFromRepository() {
    this.loadModuleById.emit(this.externalModuleId);
  }

  /**
   * Deletes a module
   */
  deleteModule(module: Module) {
    this.confirmDialog('Delete ' + module.name + ' ?', module.path, {
      buttonTrueText: 'Delete',
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.delete.emit(module.id);
      }
    });
  }

  confirmDialog(
    title: string,
    message: string,
    data?: any
  ): Observable<boolean> {
    let dialogRef: MatDialogRef<ConfirmDialogComponent>;
    dialogRef = this.dialog.open(ConfirmDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }
}
