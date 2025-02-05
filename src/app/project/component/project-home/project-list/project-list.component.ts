// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  AfterViewInit,
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
import {
  Project,
  ProjectPermission,
  SystemPermission,
} from '../../../../generated/caster-api';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ProjectService } from 'src/app/project/state';
import { filter, map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { PermissionService } from 'src/app/permissions/permission.service';

const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() projects: Project[];
  @Input() isLoading: boolean;
  @Input() manageMode = false;

  @Output() selectedProjectId = new EventEmitter<string>();

  @ViewChild('createInput', { static: true }) createInput: HTMLInputElement;
  @ViewChild(MatSort) sort: MatSort;

  filterString = '';
  displayedColumns: string[] = ['name', 'actions'];
  dataSource: MatTableDataSource<Project> = new MatTableDataSource();

  canManageAll$: Observable<boolean>;
  canManageProjects$: Observable<string[]>;
  canCreate$: Observable<boolean>;

  constructor(
    private projectService: ProjectService,
    private dialogService: ConfirmDialogService,
    private dialog: MatDialog,
    private permissionService: PermissionService
  ) {
    this.canManageAll$ = this.permissionService.permissions$.pipe(
      map((x) => x.includes(SystemPermission.ManageProjects))
    );
    this.canManageProjects$ = this.permissionService.projectPermissions$.pipe(
      map((x) =>
        x.map((y) =>
          y.permissions.includes(ProjectPermission.ManageProject)
            ? y.projectId
            : null
        )
      ),
      filter((x) => x != null)
    );

    this.canCreate$ = this.permissionService.hasPermission(
      SystemPermission.CreateProjects
    );
  }

  ngOnInit() {
    this.loadProjects();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.projects) {
      this.loadProjects();
      this.dataSource.data = changes.projects.currentValue;
    }
    if (changes.isLoading) {
      this.isLoading = changes.isLoading.currentValue;
    }
  }

  private loadProjects() {
    this.permissionService.loadProjectPermissions().subscribe();
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
