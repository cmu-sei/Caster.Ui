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
import {
  Project,
  ProjectPermission,
  RunStatus,
  SystemPermission,
} from '../../../../generated/caster-api';
import { MatSort, MatSortable } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { ProjectService } from 'src/app/project/state';
import { filter, map, take, catchError, concatMap } from 'rxjs/operators';
import { Observable, of, forkJoin } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DirectoryQuery } from 'src/app/directories/state';
import { WorkspaceQuery, WorkspaceService } from 'src/app/workspace/state';

const NAME_VALUE = 'nameValue';
const DESCRIPTION_VALUE = 'descriptionValue';

@Component({
    selector: 'cas-project-list',
    templateUrl: './project-list.component.html',
    styleUrls: ['./project-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ProjectListComponent implements OnInit, OnChanges {
  @Input() projects: Project[];
  @Input() isLoading: boolean;
  @Input() manageMode = false;

  @Output() selectedProjectId = new EventEmitter<string>();

  @ViewChild('createInput', { static: true }) createInput: HTMLInputElement;
  @ViewChild(MatSort, { static: false }) sort: MatSort;

  @ViewChild(MatPaginator) set paginator(paginator: MatPaginator) {
    if (paginator) {
      this.dataSource.paginator = paginator;
    }
  }

  filterString = '';
  displayedColumns: string[] = ['actions', 'name', 'description', 'dateCreated'];
  dataSource: MatTableDataSource<Project> = new MatTableDataSource();

  canManageAll$: Observable<boolean>;
  canManageProjects$: Observable<string[]>;
  canCreate$: Observable<boolean>;

  constructor(
    private projectService: ProjectService,
    private dialogService: ConfirmDialogService,
    private dialog: MatDialog,
    private permissionService: PermissionService,
    private snackBar: MatSnackBar,
    private directoryQuery: DirectoryQuery,
    private workspaceQuery: WorkspaceQuery,
    private workspaceService: WorkspaceService,
    private router: Router
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
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
    this.filterAndSort(this.filterString);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.projects) {
      this.loadProjects();
      this.dataSource.data = changes.projects.currentValue;
      if (this.sort) {
        this.dataSource.sort = this.sort;
      }
      this.filterAndSort(this.filterString);
    }
    if (changes.isLoading) {
      this.isLoading = changes.isLoading.currentValue;
    }
  }

  filterAndSort(filterValue: string) {
    this.dataSource.filter = filterValue;
  }

  private loadProjects() {
    this.permissionService.loadProjectPermissions().subscribe();
  }

  selectProject(projectId: string) {
    this.selectedProjectId.emit(projectId);
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue.toLowerCase();
    this.filterAndSort(this.filterString);
  }

  clearFilter() {
    this.applyFilter('');
  }

  create() {
    this.nameDialog('Create New Project?', '', {
      nameValue: '',
      showDescription: true,
      descriptionValue: '',
    }).subscribe((result) => {
      if (!result[this.dialogService.WAS_CANCELLED]) {
        const newProject = {
          name: result[NAME_VALUE],
          description: result[DESCRIPTION_VALUE],
        } as Project;
        this.projectService
          .createProject(newProject)
          .pipe(take(1))
          .subscribe((project) => {
            // Open the newly created project
            this.router.navigate(['/projects', project.id]);
          });
      }
    });
  }

  createRequest() {
    this.create();
  }

  update(project: Project) {
    this.nameDialog('Edit ' + project.name, '', {
      nameValue: project.name,
      showDescription: true,
      descriptionValue: project.description,
    }).subscribe((result) => {
      if (!result[this.dialogService.WAS_CANCELLED]) {
        const updatedProject = {
          ...project,
          name: result[NAME_VALUE],
          description: result[DESCRIPTION_VALUE],
        } as Project;
        this.projectService
          .updateProject(updatedProject)
          .pipe(take(1))
          .subscribe();
      }
    });
  }

  delete(project: Project) {
    // Get all directories in this project
    const directories = this.directoryQuery.getAll({
      filterBy: (d) => d.projectId === project.id
    });

    // Get all workspaces in those directories
    const workspaces = this.workspaceQuery.getAll({
      filterBy: (w) => directories.some(d => d.id === w.directoryId)
    });

    if (workspaces.length === 0) {
      // No workspaces, proceed with delete
      this.proceedWithDelete(project);
      return;
    }

    // Terminal run statuses (completed)
    const terminalStatuses: RunStatus[] = [RunStatus.Applied, RunStatus.Failed, RunStatus.Rejected];

    // Load resources for all workspaces
    const resourceChecks = workspaces.map(w =>
      this.workspaceService.loadResourcesByWorkspaceId(w.id).pipe(
        take(1),
        catchError(() => of(null))
      )
    );

    forkJoin(resourceChecks).pipe(
      take(1),
      map(() => {
        // Check loaded resources and runs
        const hasResources = workspaces.some(w => {
          const updated = this.workspaceQuery.getEntity(w.id);
          return updated?.resources && updated.resources.length > 0;
        });

        const hasRuns = workspaces.some(w => {
          const updated = this.workspaceQuery.getEntity(w.id);
          return updated?.runs && updated.runs.some(r => !terminalStatuses.includes(r.status));
        });

        return { hasResources, hasRuns };
      })
    ).subscribe(({ hasResources, hasRuns }) => {
      if (hasResources) {
        this.confirmDialog(
          'Cannot Delete Project',
          'Project has deployed resources and cannot be deleted. Please destroy the resources first.',
          { buttonTrueText: 'OK', buttonFalseText: '' }
        ).subscribe();
      } else if (hasRuns) {
        this.confirmDialog(
          'Cannot Delete Project',
          'Project has pending runs and cannot be deleted. Please wait for runs to complete or reject them.',
          { buttonTrueText: 'OK', buttonFalseText: '' }
        ).subscribe();
      } else {
        this.proceedWithDelete(project);
      }
    });
  }

  private proceedWithDelete(project: Project) {
    this.confirmDialog(
      'Delete Project?',
      'Delete Project ' + project.name + '?',
      { buttonTrueText: 'Delete' }
    ).subscribe((result) => {
      if (!result[this.dialogService.WAS_CANCELLED]) {
        this.projectService.deleteProject(project.id).pipe(
          take(1),
          catchError((error) => {
            const message = error.error?.message || error.message || error.statusText || 'Failed to delete project';
            this.snackBar.open(
              message,
              'Dismiss',
              {
                duration: 5000,
                verticalPosition: 'top',
                horizontalPosition: 'center'
              }
            );
            return of(null);
          })
        ).subscribe();
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
    dialogRef = this.dialog.open(NameDialogComponent, { data: data || {}, minWidth: '400px', maxWidth: '90vw' });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }
}
