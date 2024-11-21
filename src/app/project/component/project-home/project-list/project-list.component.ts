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
import { ProjectService } from 'src/app/project/state';
import { take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';

const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent implements OnInit, OnChanges {
  @Input() projects: Project[];
  @Input() isLoading: boolean;
  @Input() manageMode = false;

  @Output() selectedProjectId = new EventEmitter<string>();

  @ViewChild('createInput', { static: true }) createInput: HTMLInputElement;
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  filterString = '';
  displayedColumns: string[] = ['name'];
  dataSource: MatTableDataSource<Project> = new MatTableDataSource();

  constructor(
    private projectService: ProjectService,
    private dialogService: ConfirmDialogService,
    private dialog: MatDialog
  ) {}

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

  selectProject(projectId: string) {
    this.selectedProjectId.emit(projectId);
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

  create() {
    this.nameDialog('Create New Project?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (!result[this.dialogService.WAS_CANCELLED]) {
          const newProject = {
            name: result[NAME_VALUE],
          } as Project;
          this.projectService
            .createProject(newProject)
            .pipe(take(1))
            .subscribe();
        }
      }
    );
  }

  update(project: Project) {
    this.nameDialog('Rename ' + project.name, '', {
      nameValue: project.name,
    }).subscribe((result) => {
      if (!result[this.dialogService.WAS_CANCELLED]) {
        const updatedProject = {
          ...project,
          name: result[NAME_VALUE],
        } as Project;
        this.projectService
          .updateProject(updatedProject)
          .pipe(take(1))
          .subscribe();
      }
    });
  }

  delete(project: Project) {
    this.confirmDialog(
      'Delete Project?',
      'Delete Project ' + project.name + '?',
      { buttonTrueText: 'Delete' }
    ).subscribe((result) => {
      if (!result[this.dialogService.WAS_CANCELLED]) {
        this.projectService.deleteProject(project.id).pipe(take(1)).subscribe();
      }
    });
  }

  confirmDialog(
    title: string,
    message: string,
    data?: any
  ): Observable<boolean> {
    return this.dialogService.confirmDialog(title, message, data);
  }

  nameDialog(title: string, message: string, data?: any): Observable<boolean> {
    let dialogRef: MatDialogRef<NameDialogComponent>;
    dialogRef = this.dialog.open(NameDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }
}
