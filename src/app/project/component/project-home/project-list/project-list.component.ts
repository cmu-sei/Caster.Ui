// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Project } from '../../../../generated/caster-api';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

@Component({
  selector: 'cas-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent implements OnInit, OnChanges {
  @Input() projects: Project[];
  @Input() isLoading: boolean;

  @Output() create: EventEmitter<string> = new EventEmitter<string>();
  @Output() update: EventEmitter<Project> = new EventEmitter<Project>();
  @Output() delete: EventEmitter<Project> = new EventEmitter<Project>();

  @ViewChild('createInput', { static: true }) createInput: HTMLInputElement;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  filterString = '';
  displayedColumns: string[] = ['name'];
  dataSource: MatTableDataSource<Project> = new MatTableDataSource();

  constructor() {}

  ngOnInit() {
    if (this.projects) {
      this.dataSource = new MatTableDataSource(this.projects);
      if (this.sort) {
        this.sort.disableClear = true;
        this.sort.sort({ id: 'name', start: 'asc' } as MatSortable);
        this.dataSource.sort = this.sort;
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.projects) {
      this.dataSource.data = changes.projects.currentValue;
    }
    if (changes.isLoading) {
      this.isLoading = changes.isLoading.currentValue;
    }
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.trim(); // Remove whitespace
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.dataSource.filter = filterValue;
  }

  clearFilter() {
    this.applyFilter('');
  }

  deleteRequest(project: Project) {
    this.delete.emit(project);
  }

  updateRequest(project: Project) {
    this.update.emit(project);
  }

  createRequest() {
    this.create.emit();
  }
}
