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
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ConfirmDialogComponent } from 'src/app/sei-cwd-common/confirm-dialog/components/confirm-dialog.component';
import { Module } from '../../../../generated/caster-api';
import { Observable } from 'rxjs';

const WAS_CANCELLED = 'wasCancelled';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
    selector: 'cas-admin-module-list',
    templateUrl: './module-list.component.html',
    styleUrls: ['./module-list.component.css'],
    standalone: false
})
export class AdminModuleListComponent implements OnInit, OnChanges {
  public displayedColumns: string[] = ['name', 'path', 'versionsCount', 'dateModified'];
  public filterString = '';
  public savedFilterString = '';
  public dataSource = new MatTableDataSource<Module>(new Array<Module>());
  public externalModuleId = '';

  @Input() modules: Module[];
  @Input() isLoading: boolean;
  @Input() canEdit: boolean;
  @Output() load: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() loadModuleById: EventEmitter<string> = new EventEmitter<string>();
  @Output() delete: EventEmitter<string> = new EventEmitter<string>();
  @ViewChild(MatPaginator, { static: true }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    this.dataSource.sort = this.sort;
    this.filterAndSort(this.filterString);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!!changes.modules && !!changes.modules.currentValue) {
      this.dataSource.data = changes.modules.currentValue;
      this.filterAndSort(this.filterString);
    }
  }

  filterAndSort(filterValue: string) {
    this.dataSource.filter = filterValue;
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue.toLowerCase();
    this.filterAndSort(this.filterString);
  }

  clearFilter() {
    this.applyFilter('');
  }

  updateAllModules() {
    this.load.emit(true);
  }

  updateModuleFromRepository() {
    this.loadModuleById.emit(this.externalModuleId);
  }

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
