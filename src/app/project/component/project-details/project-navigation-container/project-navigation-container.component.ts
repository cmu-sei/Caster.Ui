// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';
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
import { Directory, Project } from '../../../../generated/caster-api';
import { map, take, takeUntil } from 'rxjs/operators';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { ProjectExportComponent } from '../project-export/project-export.component';
import { PermissionService } from 'src/app/permissions/permission.service';

const WAS_CANCELLED = 'wasCancelled';
const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-project-navigation',
  templateUrl: './project-navigation-container.component.html',
  styleUrls: ['./project-navigation-container.component.scss'],
})
export class ProjectNavigationContainerComponent implements OnInit, OnDestroy {
  public project$: Observable<Project>;
  public projectDirectories$: Observable<Directory[]>;
  public projectId: string;
  public objType = ProjectObjectType.PROJECT;

  public canEdit$: Observable<boolean>;

  private unsubscribe$ = new Subject<void>();

  @ViewChild('exportDialog') exportDialog: TemplateRef<ProjectExportComponent>;
  private exportDialogRef: MatDialogRef<ProjectExportComponent>;

  constructor(
    private routerQuery: RouterQuery,
    private projectQuery: ProjectQuery,
    private projectService: ProjectService,
    private projectStore: ProjectStore,
    private directoryQuery: DirectoryQuery,
    private directoryService: DirectoryService,
    private dialog: MatDialog,
    private permissionService: PermissionService
  ) {}

  ngOnInit() {
    this.routerQuery
      .select('state')
      .pipe(
        map((state) => {
          return state.params;
        }),
        takeUntil(this.unsubscribe$)
      )
      .subscribe((params) => {
        this.projectId = params.id;

        if (this.projectId) {
          this.project$ = this.projectQuery.selectActive();
          this.projectDirectories$ = this.directoryQuery.selectAll({
            filterBy: (dir) =>
              dir.projectId === this.projectId && dir.parentId === null,
          });

          // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
          this.projectService
            .loadProject(this.projectId)
            .pipe(take(1))
            .subscribe();
          // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
          this.directoryService
            .loadDirectories(this.projectId)
            .pipe(take(1))
            .subscribe();

          this.projectStore.setActive(this.projectId);
          this.projectStore.ui.setActive(this.projectId);

          this.canEdit$ = this.permissionService.canEditProject(this.projectId);
        }
      });
  }

  nameDialog(title: string, message: string, data?: any): Observable<boolean> {
    let dialogRef: MatDialogRef<NameDialogComponent>;
    dialogRef = this.dialog.open(NameDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }

  createNewDirectory(dirId?: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.nameDialog('Create New Directory?', '', { nameValue: '' })
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[WAS_CANCELLED]) {
          this.directoryService.add({
            name: result[NAME_VALUE],
            projectId: this.projectId,
            parentId: null,
          } as Directory);
        }
      });
  }

  exportProject() {
    this.exportDialogRef = this.dialog.open(this.exportDialog);
  }

  onExportComplete() {
    this.exportDialogRef.close();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
