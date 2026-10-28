// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  inject,
  viewChild,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';
import {
  DirectoryQuery,
  DirectoryService,
  DirectoryUI,
} from '../../../../../directories/state';
import { FileQuery, FileService } from '../../../../../files/state';
import {
  StatusFilter,
  WorkspaceQuery,
  WorkspaceService,
} from '../../../../../workspace/state';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  MatMenuTrigger,
  MatMenu,
  MatMenuContent,
  MatMenuItem,
} from '@angular/material/menu';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import {
  Design,
  Directory,
  ModelFile,
  Run,
  RunStatus,
  Workspace,
} from 'src/app/generated/caster-api';
import { ProjectObjectType, ProjectService } from 'src/app/project/state';
import { take, catchError, map, concatMap } from 'rxjs/operators';
import { ProjectExportComponent } from '../../project-export/project-export.component';
import FileDownloadUtils from 'src/app/shared/utilities/file-download-utils';
import { WorkspaceEditContainerComponent } from 'src/app/workspace/components/workspace-edit-container/workspace-edit-container.component';
import { DirectoryEditContainerComponent } from 'src/app/directories/components/directory-edit-container/directory-edit-container.component';
import { DesignQuery } from 'src/app/designs/state/design.query';
import { DesignService } from 'src/app/designs/state/design.service';
import {
  AiDesignDraftDialogComponent,
  AiDesignDraftDialogData,
} from 'src/app/designs/components/ai-design-draft-dialog/ai-design-draft-dialog.component';
import { Validators } from '@angular/forms';
import { ValidatorPatterns } from 'src/app/shared/models/validator-patterns';
import { PermissionService } from 'src/app/permissions/permission.service';
import { ProjectImportComponent } from '../../project-import/project-import.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatBadge } from '@angular/material/badge';
import { MatList, MatListItem, MatDivider } from '@angular/material/list';
import { MatTooltip } from '@angular/material/tooltip';
import { NgClass, AsyncPipe } from '@angular/common';
import { WorkspaceEditContainerComponent as WorkspaceEditContainerComponent_1 } from '../../../../../workspace/components/workspace-edit-container/workspace-edit-container.component';
import { DirectoryEditContainerComponent as DirectoryEditContainerComponent_1 } from '../../../../../directories/components/directory-edit-container/directory-edit-container.component';
import { FilesFilterPipe } from '../../../../pipes/files-filter-pipe';

const NAME_VALUE = 'nameValue';
const TERMINAL_RUN_STATUSES: RunStatus[] = [
  RunStatus.Applied,
  RunStatus.Failed,
  RunStatus.Rejected,
];

@Component({
  selector: 'cas-directory-panel',
  templateUrl: './directory-panel.component.html',
  styleUrls: ['./directory-panel.component.scss'],
  imports: [
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIcon,
    MatBadge,
    MatList,
    MatListItem,
    MatTooltip,
    MatDivider,
    NgClass,
    MatMenuTrigger,
    MatMenu,
    MatMenuContent,
    MatMenuItem,
    ProjectExportComponent,
    ProjectImportComponent,
    WorkspaceEditContainerComponent_1,
    DirectoryEditContainerComponent_1,
    AsyncPipe,
    FilesFilterPipe,
  ],
})
export class DirectoryPanelComponent implements OnInit, OnDestroy {
  private directoryService = inject(DirectoryService);
  private directoryQuery = inject(DirectoryQuery);
  private fileService = inject(FileService);
  private fileQuery = inject(FileQuery);
  private workspaceQuery = inject(WorkspaceQuery);
  private workspaceService = inject(WorkspaceService);
  private projectService = inject(ProjectService);
  private dialog = inject(MatDialog);
  private confirmService = inject(CrucibleDialogService);
  private designQuery = inject(DesignQuery);
  private designService = inject(DesignService);
  private permissionService = inject(PermissionService);
  private snackBar = inject(MatSnackBar);

  @Input() parentDirectory: Directory;
  public parentDirectoryUI$: Observable<DirectoryUI>;
  public panelOpenState = false;
  public directories$: Observable<Directory[]>;
  public files$: Observable<ModelFile[]>;
  public parentFiles$: Observable<ModelFile[]>;
  public workspaces$: Observable<Workspace[]>;
  public designs$: Observable<Design[]>;
  public ProjectObjectType = ProjectObjectType; // For usage in html

  public exportId: string;
  public exportObjectType: ProjectObjectType;
  public exportName: string;

  public editingWorkspaceId: string;
  public editingDirectoryId: string;

  public canEdit$: Observable<boolean>;

  private _destroyed$ = new Subject();

  readonly contextMenu = viewChild(MatMenuTrigger);

  readonly exportDialog =
    viewChild<TemplateRef<ProjectExportComponent>>('exportDialog');
  private exportDialogRef: MatDialogRef<ProjectExportComponent>;

  readonly importDialog =
    viewChild<TemplateRef<ProjectImportComponent>>('importDialog');
  private importDialogRef: MatDialogRef<ProjectImportComponent>;

  readonly workspaceEditDialog = viewChild<
    TemplateRef<WorkspaceEditContainerComponent>
  >('workspaceEditDialog');
  private workspaceEditDialogRef: MatDialogRef<WorkspaceEditContainerComponent>;

  readonly directoryEditDialog = viewChild<
    TemplateRef<DirectoryEditContainerComponent>
  >('directoryEditDialog');
  private directoryEditDialogRef: MatDialogRef<DirectoryEditContainerComponent>;

  contextMenuPosition = { x: '0px', y: '0px' };

  ngOnInit() {
    this.canEdit$ = this.permissionService.canEditProject(
      this.parentDirectory.projectId,
    );

    if (this.parentDirectory) {
      this.parentDirectoryUI$ = this.directoryQuery.ui.selectEntity(
        this.parentDirectory.id,
      );

      this.directories$ = this.directoryQuery.selectAll({
        filterBy: (d) =>
          d.parentId === this.parentDirectory.id &&
          d.projectId === this.parentDirectory.projectId,
      });

      this.files$ = this.fileQuery.selectAll({
        filterBy: (f) => f.directoryId === this.parentDirectory.id,
      });
      this.parentFiles$ = this.fileQuery.selectAll({
        filterBy: (f) =>
          f.directoryId === this.parentDirectory.id && f.workspaceId === null,
      });

      this.workspaces$ = this.workspaceQuery.selectAll({
        filterBy: (w) => w.directoryId === this.parentDirectory.id,
      });

      this.designs$ = this.designQuery.selectAll({
        filterBy: (d) => d.directoryId === this.parentDirectory.id,
      });
    }
  }

  ngOnDestroy() {
    this._destroyed$.next(null);
    this._destroyed$.complete();
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

  deleteDirectory(dir: Directory) {
    // Get all child directories (recursive)
    const childDirectories = this.directoryQuery.getAll({
      filterBy: (d) => this.isDescendant(d, dir.id),
    });

    // Get all workspaces in this directory and its children
    const allDirectoryIds = [dir.id, ...childDirectories.map((d) => d.id)];
    const workspaces = this.workspaceQuery.getAll({
      filterBy: (w) => allDirectoryIds.includes(w.directoryId),
    });

    // Check if any workspace has resources or incomplete runs
    const hasResources = workspaces.some(
      (w) => w.resources && w.resources.length > 0,
    );
    const hasIncompleteRuns = workspaces.some(
      (w) =>
        w.runs && w.runs.some((r) => !TERMINAL_RUN_STATUSES.includes(r.status)),
    );

    if (hasResources) {
      this.confirmService.confirm({
        title: 'Cannot Delete Directory',
        message:
          'Directory has deployed resources and cannot be deleted. Please destroy the resources first.',
        confirmText: 'OK',
        cancelText: '',
      });
      return;
    }

    if (hasIncompleteRuns) {
      this.confirmService.confirm({
        title: 'Cannot Delete Directory',
        message:
          'Directory has pending runs and cannot be deleted. Please wait for runs to complete or reject them.',
        confirmText: 'OK',
        cancelText: '',
      });
      return;
    }

    // Show confirmation dialog and proceed with deletion
    this.confirmService
      .confirm({
        title: 'Delete Directory?',
        message: 'Delete directory ' + dir.name + '?',
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.directoryService
            .delete(dir.id)
            .pipe(
              take(1),
              catchError((error) => {
                const message =
                  error.error?.message ||
                  error.message ||
                  error.statusText ||
                  'Failed to delete directory';
                this.snackBar.open(message, 'Dismiss', {
                  duration: 5000,
                  verticalPosition: 'top',
                  horizontalPosition: 'center',
                });
                return of(null);
              }),
            )
            .subscribe();
        }
      });
  }

  private isDescendant(directory: Directory, ancestorId: string): boolean {
    if (directory.parentId === ancestorId) {
      return true;
    }
    if (!directory.parentId) {
      return false;
    }
    const parent = this.directoryQuery.getEntity(directory.parentId);
    return parent ? this.isDescendant(parent, ancestorId) : false;
  }

  createNewDirectory(dirId?: string) {
    this.nameDialog('Create New Directory?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (result) {
          const newDir = {
            name: result[NAME_VALUE],
            projectId: this.parentDirectory.projectId,
            parentId: dirId,
          };
          this.directoryService.add(newDir);
        }
      },
    );
  }

  renameDirectory() {
    this.nameDialog('Rename ' + this.parentDirectory.name, '', {
      nameValue: this.parentDirectory.name,
    }).subscribe((result) => {
      if (result) {
        const updatedDirectory = {
          ...this.parentDirectory,
          name: result[NAME_VALUE],
        } as Directory;
        this.directoryService.update(updatedDirectory);
      }
    });
  }

  createFile(dirId: string, workspaceId?: string) {
    this.nameDialog('Create New File?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (result) {
          const newFile = {
            workspaceId: workspaceId ? workspaceId : null,
            directoryId: dirId,
            content: '',
            name: result[NAME_VALUE],
          } as ModelFile;
          this.fileService.add(newFile);
        }
      },
    );
  }

  renameFile(file: ModelFile) {
    this.nameDialog('Rename ' + file.name, '', {
      nameValue: file.name,
    }).subscribe((result) => {
      if (result) {
        this.fileService.renameFile(file.id, result[NAME_VALUE]);
      }
    });
  }

  deleteFile(file: ModelFile) {
    this.confirmService
      .confirm({
        title: 'Delete File?',
        message: 'Delete file ' + file.name + '?',
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.fileService.delete(file);
        }
      });
  }

  renameWorkspace(workspace: Workspace) {
    this.nameDialog('Rename ' + workspace.name, '', {
      nameValue: workspace.name,
    }).subscribe((result) => {
      if (result) {
        const newWorkspace = { ...workspace, name: result[NAME_VALUE] };
        this.workspaceService.update(newWorkspace);
      }
    });
  }

  createWorkspace() {
    this.nameDialog('Create New Workspace?', '', {
      nameValue: '',
      validators: [
        {
          validator: Validators.maxLength(90),
          name: 'maxlength',
          errorMessage: 'Must be 90 characters or fewer',
        },
        {
          validator: Validators.pattern(ValidatorPatterns.WorkspaceName),
          name: 'pattern',
          errorMessage: 'Only use letters, numbers, -, _, and .',
        },
      ],
    }).subscribe((result) => {
      if (result) {
        const newWorkspace = {
          directoryId: this.parentDirectory.id,
          name: result[NAME_VALUE],
          statusFilter: new Array<StatusFilter>(),
          runs: new Array<Run>(),
        } as Workspace;
        this.workspaceService.add(newWorkspace);
      }
    });
  }

  deleteWorkspace(workspace: Workspace) {
    // Check if workspace has resources or incomplete runs
    const workspaceEntity = this.workspaceQuery.getEntity(workspace.id);

    const hasResources =
      workspaceEntity &&
      workspaceEntity.resources &&
      workspaceEntity.resources.length > 0;
    const hasIncompleteRuns =
      workspaceEntity &&
      workspaceEntity.runs &&
      workspaceEntity.runs.some(
        (r) => !TERMINAL_RUN_STATUSES.includes(r.status),
      );

    if (hasResources) {
      this.confirmService.confirm({
        title: 'Cannot Delete Workspace',
        message:
          'Workspace has deployed resources and cannot be deleted. Please destroy the resources first.',
        confirmText: 'OK',
        cancelText: '',
      });
      return;
    }

    if (hasIncompleteRuns) {
      this.confirmService.confirm({
        title: 'Cannot Delete Workspace',
        message:
          'Workspace has pending runs and cannot be deleted. Please wait for runs to complete or reject them.',
        confirmText: 'OK',
        cancelText: '',
      });
      return;
    }

    // Check resources via API to be sure
    this.workspaceService
      .loadResourcesByWorkspaceId(workspace.id)
      .pipe(
        take(1),
        map(() => this.workspaceQuery.getEntity(workspace.id)),
        concatMap((updatedWorkspace) => {
          const hasResourcesAfterLoad =
            updatedWorkspace &&
            updatedWorkspace.resources &&
            updatedWorkspace.resources.length > 0;
          const hasIncompleteRunsAfterLoad =
            updatedWorkspace &&
            updatedWorkspace.runs &&
            updatedWorkspace.runs.some(
              (r) => !TERMINAL_RUN_STATUSES.includes(r.status),
            );

          if (hasResourcesAfterLoad) {
            return this.confirmService
              .confirm({
                title: 'Cannot Delete Workspace',
                message:
                  'Workspace has deployed resources and cannot be deleted. Please destroy the resources first.',
                confirmText: 'OK',
                cancelText: '',
              })
              .afterClosed()
              .pipe(map(() => null));
          }

          if (hasIncompleteRunsAfterLoad) {
            return this.confirmService
              .confirm({
                title: 'Cannot Delete Workspace',
                message:
                  'Workspace has pending runs and cannot be deleted. Please wait for runs to complete or reject them.',
                confirmText: 'OK',
                cancelText: '',
              })
              .afterClosed()
              .pipe(map(() => null));
          }

          // No resources or runs, proceed with normal delete confirmation
          return this.confirmService
            .confirm({
              title: 'Delete workspace?',
              message: 'Delete workspace ' + workspace.name + '?',
              confirmText: 'Delete',
            })
            .afterClosed()
            .pipe(
              concatMap((confirmed) => {
                if (confirmed) {
                  return this.workspaceService.delete(workspace).pipe(
                    catchError((error) => {
                      const message =
                        error.error?.message ||
                        error.message ||
                        error.statusText ||
                        'Failed to delete workspace';
                      this.snackBar.open(message, 'Dismiss', {
                        duration: 5000,
                        verticalPosition: 'top',
                        horizontalPosition: 'center',
                      });
                      return of(null);
                    }),
                  );
                }
                return of(null);
              }),
            );
        }),
      )
      .subscribe();
  }

  createDesign(dirId: string) {
    this.nameDialog('Create New Design?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (result) {
          const newDesign = {
            directoryId: dirId,
            name: result[NAME_VALUE],
          } as Design;
          this.designService.create(newDesign);
        }
      },
    );
  }

  draftDesignWithAi(dir: Directory) {
    this.dialog
      .open<AiDesignDraftDialogComponent, AiDesignDraftDialogData, Design>(
        AiDesignDraftDialogComponent,
        {
          data: { directoryId: dir.id, directoryName: dir.name },
          width: '800px',
          maxWidth: '95vw',
          maxHeight: '90vh',
        }
      )
      .afterClosed()
      .subscribe((design) => {
        if (design) {
          // SignalR adds it too; add() skips an id that is already there
          this.designService.add(design);
          this.openDesign(design);
        }
      });
  }

  renameDesign(design: Design) {
    this.nameDialog('Rename ' + design.name, '', {
      nameValue: design.name,
    }).subscribe((result) => {
      if (result) {
        const newDesign = { ...design, name: result[NAME_VALUE] };
        this.designService.edit(design.id, newDesign);
      }
    });
  }

  deleteDesign(design: Design) {
    this.confirmService
      .confirm({
        title: 'Delete design?',
        message: 'Delete design ' + design.name + '?',
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.designService.delete(design.id);
        }
      });
  }

  toggleIsExpanded(dirUI: DirectoryUI) {
    this.directoryService.toggleIsExpanded(dirUI);
  }

  toggleIsFilesExpanded(dirUI: DirectoryUI) {
    this.directoryService.toggleIsFilesExpanded(dirUI);
  }

  toggleIsWorkspacesExpanded(dirUI: DirectoryUI) {
    this.directoryService.toggleIsWorkspacesExpanded(dirUI);
  }

  toggleIsDirectoriesExpanded(dirUI: DirectoryUI) {
    this.directoryService.toggleIsDirectoriesExpanded(dirUI);
  }

  toggleIsDesignsExpanded(dirUI: DirectoryUI) {
    this.directoryService.toggleIsDesignsExpanded(dirUI);
  }

  openFile(file: ModelFile) {
    // open a file type tab
    this.projectService.openTab(file, ProjectObjectType.FILE);
  }

  openWorkspace(workspace: Workspace) {
    this.projectService.openTab(workspace, ProjectObjectType.WORKSPACE);
  }

  openDesign(design: Design) {
    this.projectService.openTab(design, ProjectObjectType.DESIGN);
  }

  toggleIsWorkspaceExpanded(workspaceId: string) {
    this.workspaceService.toggleIsExpanded(workspaceId);
  }

  isWorkspaceExpanded(workspaceId: string): boolean {
    return this.workspaceService.isExpanded(workspaceId);
  }

  onContextMenu(
    event: MouseEvent,
    obj: ModelFile | Workspace | Directory | Design,
    objectType: ProjectObjectType,
  ) {
    event.preventDefault();
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    const contextMenu = this.contextMenu();
    contextMenu.menuData = { item: { object: obj, type: objectType } };
    contextMenu.menu.focusFirstItem('mouse');
    contextMenu.openMenu();
  }

  onContextRename(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        this.renameDirectory();
        break;
      }
      case ProjectObjectType.WORKSPACE: {
        this.renameWorkspace(obj.object as Workspace);
        break;
      }
      case ProjectObjectType.FILE: {
        this.renameFile(obj.object as ModelFile);
        break;
      }
      case ProjectObjectType.DESIGN: {
        this.renameDesign(obj.object as Design);
        break;
      }
    }
  }

  onContextEnable(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.DESIGN: {
        this.designService.toggleEnabled(obj.object as Design);
        break;
      }
    }
  }

  onContextEdit(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.WORKSPACE: {
        this.editWorkspace(obj.object as Workspace);
        break;
      }
      case ProjectObjectType.DIRECTORY: {
        this.editDirectory(obj.object as Directory);
        break;
      }
    }
  }

  editWorkspace(workspace: Workspace) {
    this.editingWorkspaceId = workspace.id;
    this.workspaceEditDialogRef = this.dialog.open(this.workspaceEditDialog(), {
      minWidth: '400px',
      maxWidth: '90vw',
    });
  }

  editDirectory(directory: Directory) {
    this.editingDirectoryId = directory.id;
    this.directoryEditDialogRef = this.dialog.open(this.directoryEditDialog(), {
      minWidth: '400px',
      maxWidth: '90vw',
    });
  }

  onEditWorkspaceComplete() {
    this.workspaceEditDialogRef.close();
  }

  onEditDirectoryComplete() {
    this.directoryEditDialogRef.close();
  }

  onContextDelete(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        this.deleteDirectory(obj.object as Directory);
        break;
      }
      case ProjectObjectType.WORKSPACE: {
        this.deleteWorkspace(obj.object as Workspace);
        break;
      }
      case ProjectObjectType.FILE: {
        this.deleteFile(obj.object as ModelFile);
        break;
      }
      case ProjectObjectType.DESIGN: {
        this.deleteDesign(obj.object as Design);
        break;
      }
    }
  }

  onContextExport(obj: any) {
    if (obj.type === ProjectObjectType.FILE) {
      this.fileService
        .export(obj.object.id)
        .pipe(take(1))
        // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
        .subscribe((result) => {
          FileDownloadUtils.downloadFile(result.blob, result.filename);
        });
    } else {
      this.exportId = obj.object.id;
      this.exportName = obj.object.name;
      this.exportObjectType = obj.type as ProjectObjectType;
      this.exportDialogRef = this.dialog.open(this.exportDialog(), {
        width: '480px',
        maxWidth: '90vw',
      });
    }
  }

  onContextImport(obj: any) {
    this.exportId = obj.object.id;
    this.exportName = obj.object.name;
    this.exportObjectType = obj.type as ProjectObjectType;
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

  isExportable(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        return true;
      }
      case ProjectObjectType.WORKSPACE: {
        return false;
      }
      case ProjectObjectType.PROJECT: {
        return true;
      }
      case ProjectObjectType.FILE: {
        return true;
      }
      case ProjectObjectType.DESIGN: {
        return false;
      }
    }
  }

  canRename(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        return false;
      }
      case ProjectObjectType.WORKSPACE: {
        return false;
      }
      case ProjectObjectType.PROJECT: {
        return true;
      }
      case ProjectObjectType.FILE: {
        return true;
      }
      case ProjectObjectType.DESIGN: {
        return true;
      }
    }
  }

  canEnable(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        return false;
      }
      case ProjectObjectType.WORKSPACE: {
        return false;
      }
      case ProjectObjectType.PROJECT: {
        return false;
      }
      case ProjectObjectType.FILE: {
        return false;
      }
      case ProjectObjectType.DESIGN: {
        return true;
      }
    }
  }

  canEdit(obj: any) {
    const type = obj.type as ProjectObjectType;
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        return true;
      }
      case ProjectObjectType.WORKSPACE: {
        return true;
      }
      case ProjectObjectType.PROJECT: {
        return false;
      }
      case ProjectObjectType.FILE: {
        return false;
      }
      case ProjectObjectType.DESIGN: {
        return false;
      }
    }
  }
}
