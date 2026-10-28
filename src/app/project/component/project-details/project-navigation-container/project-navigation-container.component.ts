// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  inject,
  viewChild,
} from '@angular/core';
import { EMPTY, Observable, Subject } from 'rxjs';
import {
  ProjectObjectType,
  ProjectQuery,
  ProjectService,
  ProjectStore,
} from '../../../state';
import {
  DirectoryQuery,
  DirectoryService,
} from '../../../../directories/state';
import { WorkspaceQuery } from '../../../../workspace/state';
import { Directory, Project } from '../../../../generated/caster-api';
import { catchError, filter, take, takeUntil } from 'rxjs/operators';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { ProjectExportComponent } from '../project-export/project-export.component';
import { PermissionService } from 'src/app/permissions/permission.service';
import { ProjectImportComponent } from '../project-import/project-import.component';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DirectoryPanelComponent } from './directory-panel/directory-panel.component';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe } from '@angular/common';

const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-project-navigation',
  templateUrl: './project-navigation-container.component.html',
  styleUrls: ['./project-navigation-container.component.scss'],
  imports: [
    DirectoryPanelComponent,
    MatIcon,
    MatTooltip,
    ProjectExportComponent,
    ProjectImportComponent,
    AsyncPipe,
  ],
})
export class ProjectNavigationContainerComponent implements OnInit, OnDestroy {
  private routerQuery = inject(RouterQuery);
  private projectQuery = inject(ProjectQuery);
  private projectService = inject(ProjectService);
  private projectStore = inject(ProjectStore);
  private directoryQuery = inject(DirectoryQuery);
  private directoryService = inject(DirectoryService);
  private dialog = inject(MatDialog);
  private permissionService = inject(PermissionService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private workspaceQuery = inject(WorkspaceQuery);

  public project$: Observable<Project>;
  public projectDirectories$: Observable<Directory[]>;
  public projectId: string;
  public objType = ProjectObjectType.PROJECT;

  public canEdit$: Observable<boolean>;

  private unsubscribe$ = new Subject<void>();

  readonly exportDialog =
    viewChild<TemplateRef<ProjectExportComponent>>('exportDialog');
  private exportDialogRef: MatDialogRef<ProjectExportComponent>;

  readonly importDialog =
    viewChild<TemplateRef<ProjectImportComponent>>('importDialog');
  private importDialogRef: MatDialogRef<ProjectImportComponent>;

  ngOnInit() {
    this.routerQuery
      .select('state')
      .pipe(
        takeUntil(this.unsubscribe$),
      )
      .subscribe((state) => {
        this.projectId = state.params.id;
        // ?workspace=<id> opens that workspace and ?directory=<id> expands that directory,
        // so other apps can link straight to them
        const linkedWorkspaceId: string = state.queryParams?.workspace;
        const linkedDirectoryId: string = state.queryParams?.directory;

        if (this.projectId) {
          this.project$ = this.projectQuery.selectActive();
          this.projectDirectories$ = this.directoryQuery.selectAll({
            filterBy: (dir) =>
              dir.projectId === this.projectId && dir.parentId === null,
          });

          // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
          this.projectService
            .loadProject(this.projectId)
            .pipe(
              take(1),
              catchError((error) => {
                if (error.status === 404) {
                  this.snackBar.open('Project not found', 'Dismiss', {
                    duration: 5000,
                    verticalPosition: 'top',
                  });
                  this.router.navigate(['/']);
                }
                return EMPTY;
              }),
            )
            .subscribe();
          // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
          this.directoryService
            .loadDirectories(this.projectId)
            .pipe(
              take(1),
              catchError(() => EMPTY),
            )
            .subscribe(() => {
              // Drop any persisted tabs whose underlying file/workspace/design
              // no longer exists, so the deleted tab doesn't reappear on load.
              this.projectService.pruneDeletedTabs(this.projectId);
              if (linkedWorkspaceId || linkedDirectoryId) {
                this.openLinked(linkedWorkspaceId, linkedDirectoryId);
              }
            });

          this.projectStore.setActive(this.projectId);
          this.projectStore.ui.setActive(this.projectId);

          this.canEdit$ = this.permissionService.canEditProject(this.projectId);
        }
      });
  }

  // directories load every workspace of the project, so one missing here is not in this project.
  // A tab needs the project loaded, which can finish after the directories.
  private openLinked(workspaceId: string, directoryId: string) {
    this.projectQuery
      .selectActive()
      .pipe(
        filter((project) => project?.id === this.projectId),
        take(1),
        takeUntil(this.unsubscribe$),
      )
      .subscribe(() => {
        if (workspaceId) {
          this.openWorkspaceTab(workspaceId);
        } else {
          this.showDirectory(directoryId);
        }
        // drop the parameters so closing the tab and reloading does not open it again
        this.router.navigate([], {
          queryParams: { workspace: null, directory: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      });
  }

  private openWorkspaceTab(workspaceId: string) {
    const workspace = this.workspaceQuery.getEntity(workspaceId);
    const directory = workspace && this.directoryQuery.getEntity(workspace.directoryId);
    if (workspace && directory?.projectId === this.projectId) {
      this.directoryService.expandTo(directory.id);
      this.projectService.openTab(workspace, ProjectObjectType.WORKSPACE);
    } else {
      this.linkNotFound('workspace');
    }
  }

  private showDirectory(directoryId: string) {
    const directory = this.directoryQuery.getEntity(directoryId);
    if (directory?.projectId === this.projectId) {
      this.directoryService.expandTo(directory.id);
    } else {
      this.linkNotFound('directory');
    }
  }

  private linkNotFound(kind: string) {
    this.snackBar.open(`The linked ${kind} is not in this project`, 'Dismiss', {
      duration: 5000,
      verticalPosition: 'top'
    });
  }

  nameDialog(title: string, message: string, data?: any): Observable<any> {
    let dialogRef: MatDialogRef<NameDialogComponent>;
    dialogRef = this.dialog.open(NameDialogComponent, {
      data: data || {},
      minWidth: '400px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }

  createNewDirectory(dirId?: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.nameDialog('Add Directory', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (result) {
          this.directoryService.add({
            name: result[NAME_VALUE],
            projectId: this.projectId,
            parentId: null,
          } as Directory);
        }
      });
  }

  exportProject() {
    this.exportDialogRef = this.dialog.open(this.exportDialog(), {
      width: '480px',
      maxWidth: '90vw',
    });
  }

  importProject() {
    this.importDialogRef = this.dialog.open(this.importDialog(), {
      width: '480px',
      maxWidth: '90vw',
    });
  }

  onExportComplete() {
    this.exportDialogRef.close();
  }

  onImportComplete() {
    this.importDialogRef.close();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
