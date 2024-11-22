// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
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
import { MatMenuTrigger } from '@angular/material/menu';
import { ConfirmDialogComponent } from 'src/app/sei-cwd-common/confirm-dialog/components/confirm-dialog.component';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import {
  Design,
  Directory,
  ModelFile,
  Run,
  Workspace,
} from 'src/app/generated/caster-api';
import { ProjectObjectType, ProjectService } from 'src/app/project/state';
import { take } from 'rxjs/operators';
import { ProjectExportComponent } from '../../project-export/project-export.component';
import FileDownloadUtils from 'src/app/shared/utilities/file-download-utils';
import { WorkspaceEditContainerComponent } from 'src/app/workspace/components/workspace-edit-container/workspace-edit-container.component';
import { DirectoryEditContainerComponent } from 'src/app/directories/components/directory-edit-container/directory-edit-container.component';
import { DesignQuery } from 'src/app/designs/state/design.query';
import { DesignService } from 'src/app/designs/state/design.service';
import { Validators } from '@angular/forms';
import { ValidatorPatterns } from 'src/app/shared/models/validator-patterns';
import { PermissionService } from 'src/app/permissions/permission.service';

const WAS_CANCELLED = 'wasCancelled';
const NAME_VALUE = 'nameValue';

@Component({
  selector: 'cas-directory-panel',
  templateUrl: './directory-panel.component.html',
  styleUrls: ['./directory-panel.component.scss'],
})
export class DirectoryPanelComponent implements OnInit, OnDestroy {
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

  @ViewChild(MatMenuTrigger, { static: true }) contextMenu: MatMenuTrigger;

  @ViewChild('exportDialog') exportDialog: TemplateRef<ProjectExportComponent>;
  private exportDialogRef: MatDialogRef<ProjectExportComponent>;

  @ViewChild('workspaceEditDialog')
  workspaceEditDialog: TemplateRef<WorkspaceEditContainerComponent>;
  private workspaceEditDialogRef: MatDialogRef<WorkspaceEditContainerComponent>;

  @ViewChild('directoryEditDialog')
  directoryEditDialog: TemplateRef<DirectoryEditContainerComponent>;
  private directoryEditDialogRef: MatDialogRef<DirectoryEditContainerComponent>;

  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private directoryService: DirectoryService,
    private directoryQuery: DirectoryQuery,
    private fileService: FileService,
    private fileQuery: FileQuery,
    private workspaceQuery: WorkspaceQuery,
    private workspaceService: WorkspaceService,
    private projectService: ProjectService,
    private dialog: MatDialog,
    private designQuery: DesignQuery,
    private designService: DesignService,
    private permissionService: PermissionService
  ) {}

  ngOnInit() {
    this.canEdit$ = this.permissionService.canEditProject(
      this.parentDirectory.projectId
    );

    if (this.parentDirectory) {
      this.parentDirectoryUI$ = this.directoryQuery.ui.selectEntity(
        this.parentDirectory.id
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

  nameDialog(title: string, message: string, data?: any): Observable<boolean> {
    let dialogRef: MatDialogRef<NameDialogComponent>;
    dialogRef = this.dialog.open(NameDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }

  deleteDirectory(dir: Directory) {
    this.confirmDialog(
      'Delete Directory?',
      'Delete directory ' + dir.name + '?',
      { buttonTrueText: 'Delete' }
    ).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.directoryService.delete(dir.id);
      }
    });
  }

  createNewDirectory(dirId?: string) {
    this.nameDialog('Create New Directory?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (!result[WAS_CANCELLED]) {
          const newDir = {
            name: result[NAME_VALUE],
            projectId: this.parentDirectory.projectId,
            parentId: dirId,
          };
          this.directoryService.add(newDir);
        }
      }
    );
  }

  renameDirectory() {
    this.nameDialog('Rename ' + this.parentDirectory.name, '', {
      nameValue: this.parentDirectory.name,
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        console.log(result[NAME_VALUE]);
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
        if (!result[WAS_CANCELLED]) {
          const newFile = {
            workspaceId: workspaceId ? workspaceId : null,
            directoryId: dirId,
            content: '',
            name: result[NAME_VALUE],
          } as ModelFile;
          this.fileService.add(newFile);
        }
      }
    );
  }

  renameFile(file: ModelFile) {
    this.nameDialog('Rename ' + file.name, '', {
      nameValue: file.name,
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.fileService.renameFile(file.id, result[NAME_VALUE]);
      }
    });
  }

  deleteFile(file: ModelFile) {
    this.confirmDialog('Delete File?', 'Delete file ' + file.name + '?', {
      buttonTrueText: 'Delete',
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.fileService.delete(file);
      }
    });
  }

  renameWorkspace(workspace: Workspace) {
    this.nameDialog('Rename ' + workspace.name, '', {
      nameValue: workspace.name,
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
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
      if (!result[WAS_CANCELLED]) {
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
    this.confirmDialog(
      'Delete workspace?',
      'Delete workspace ' + workspace.name + '?',
      { buttonTrueText: 'Delete' }
    ).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        this.workspaceService.delete(workspace);
      }
    });
  }

  createDesign(dirId: string) {
    this.nameDialog('Create New Design?', '', { nameValue: '' }).subscribe(
      (result) => {
        if (!result[WAS_CANCELLED]) {
          const newDesign = {
            directoryId: dirId,
            name: result[NAME_VALUE],
          } as Design;
          this.designService.create(newDesign);
        }
      }
    );
  }

  renameDesign(design: Design) {
    this.nameDialog('Rename ' + design.name, '', {
      nameValue: design.name,
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
        const newDesign = { ...design, name: result[NAME_VALUE] };
        this.designService.edit(design.id, newDesign);
      }
    });
  }

  deleteDesign(design: Design) {
    this.confirmDialog('Delete design?', 'Delete design ' + design.name + '?', {
      buttonTrueText: 'Delete',
    }).subscribe((result) => {
      if (!result[WAS_CANCELLED]) {
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
    objectType: ProjectObjectType
  ) {
    event.preventDefault();
    this.contextMenuPosition.x = event.clientX + 'px';
    this.contextMenuPosition.y = event.clientY + 'px';
    this.contextMenu.menuData = { item: { object: obj, type: objectType } };
    this.contextMenu.menu.focusFirstItem('mouse');
    this.contextMenu.openMenu();
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
    this.workspaceEditDialogRef = this.dialog.open(this.workspaceEditDialog);
  }

  editDirectory(directory: Directory) {
    this.editingDirectoryId = directory.id;
    this.directoryEditDialogRef = this.dialog.open(this.directoryEditDialog);
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
      this.exportDialogRef = this.dialog.open(this.exportDialog);
    }
  }

  onExportComplete() {
    this.exportDialogRef.close();
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
