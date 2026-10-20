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
  inject,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
} from '@angular/material/table';
import { Module } from '../../../../generated/caster-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { ClipboardModule } from 'ngx-clipboard';
import { NgClass, DatePipe } from '@angular/common';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

export interface Action {
  Value: string;
  Text: string;
}

@Component({
  selector: 'cas-admin-module-list',
  templateUrl: './module-list.component.html',
  styleUrls: ['./module-list.component.css'],
  imports: [
    MatIcon,
    MatFormField,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatPaginator,
    MatTooltip,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatSortHeader,
    MatCellDef,
    MatCell,
    ClipboardModule,
    NgClass,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatCard,
    MatProgressSpinner,
    DatePipe,
  ],
})
export class AdminModuleListComponent implements OnInit, OnChanges {
  private confirmService = inject(CrucibleDialogService);

  public displayedColumns: string[] = [
    'name',
    'path',
    'versionsCount',
    'dateModified',
  ];
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
    this.confirmService
      .confirm({
        title: 'Delete ' + module.name + ' ?',
        message: module.path,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.delete.emit(module.id);
        }
      });
  }
}
