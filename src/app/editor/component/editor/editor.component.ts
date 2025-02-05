// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { MatButtonToggleGroup } from '@angular/material/button-toggle';
import { Theme } from '@cmusei/crucible-common';
import { Observable, Subject } from 'rxjs';
import { switchMap, take, takeUntil } from 'rxjs/operators';
import {
  FileVersionQuery,
  FileVersionService,
} from 'src/app/fileVersions/state';
import { FileVersion, ModelFile, Module } from 'src/app/generated/caster-api';
import { Breadcrumb } from 'src/app/project/state';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { CurrentUserQuery } from 'src/app/users/state';
import { FileQuery, FileService } from '../../../files/state';
import { ModuleQuery, ModuleService } from '../../../modules/state';
import { ComnSettingsService } from '@cmusei/crucible-common';

const SIDEBAR_MIN_WIDTH = 300;

@Component({
  selector: 'cas-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() fileId: string;
  @Input() modules: Module[];
  @Input() sidebarOpen: boolean;
  @Input() sidebarView: string;
  @Input() breadcrumb: Breadcrumb[];
  @Input() sidenavWidth: number;
  @Input() canEdit: boolean;
  @Input() canAdminLock: boolean;
  @Output() sidebarChanged = new EventEmitter<boolean>();
  @Output() sidebarViewChanged = new EventEmitter<string>();
  @Output() codeChanged = new EventEmitter<string>();
  @Output() sidenavWidthChanged = new EventEmitter<number>();
  @ViewChild('sidenav', { read: ElementRef }) sidenav: ElementRef;
  @ViewChild('sidebar') sidebar: MatButtonToggleGroup;
  public ngxEditor: any;
  public selectedVersionForDiff: FileVersion;
  public file: ModelFile;
  public code: string;
  public codeTheme: Theme;
  public editorOptions = {
    theme: 'vs-light',
    language: 'ruby',
    automaticLayout: true,
    readOnly: true,
  };
  public selectedModule$: Observable<Module>;
  public filename = '';
  public currentUserId: string;
  public isEditing$: Observable<boolean>;
  public isEditing = false;
  public isSaved$: Observable<boolean>;

  private unsubscribe$ = new Subject();
  public breadcrumbString = '';

  constructor(
    private moduleService: ModuleService,
    private moduleQuery: ModuleQuery,
    private fileQuery: FileQuery,
    private fileService: FileService,
    private fileVersionService: FileVersionService,
    private fileVersionQuery: FileVersionQuery,
    private currentUserQuery: CurrentUserQuery,
    private changeDetectorRef: ChangeDetectorRef,
    private confirmDialog: ConfirmDialogService,
    private settingsService: ComnSettingsService
  ) {}

  ngOnInit(): void {
    this.selectedVersionForDiff = undefined;

    this.currentUserQuery
      .select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((user) => {
        this.currentUserId = user.id;
        this.updateEditorOptions(this.file);
      });

    this.currentUserQuery.userTheme$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((theme) => {
        this.codeTheme = theme;
        this.updateEditorOptions(null);
        this.changeDetectorRef.markForCheck();
      });

    this.fileQuery
      .selectEntity(this.fileId)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((f) => {
        if (f) {
          this.filename = f.name;
          this.code = f.editorContent;

          if (!this.file || f.lockedById !== this.file.lockedById) {
            this.updateEditorOptions(f);
          }

          this.isEditing$ = this.fileQuery.isEditing(f.id, this.currentUserId);
          this.isEditing$
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((isEditing) => (this.isEditing = isEditing));
        } else {
          this.filename = '';
          this.code = '';
        }

        this.file = f;

        this.changeDetectorRef.markForCheck();
      });

    this.fileVersionService.load(this.fileId).pipe(take(1)).subscribe();

    this.fileQuery
      .getSelectedVersionId(this.fileId)
      .pipe(
        switchMap((versionId: string) =>
          this.fileVersionQuery.selectEntity(versionId)
        ),
        takeUntil(this.unsubscribe$)
      )
      .subscribe((fileVersion) => {
        if (fileVersion && fileVersion.content) {
          this.selectedVersionForDiff = fileVersion;
        } else {
          this.selectedVersionForDiff = undefined;
        }
      });

    this.isSaved$ = this.fileQuery.selectIsSaved(this.fileId);
  }

  editorInit(editor: any) {
    // get the defined hot keys
    const hotKeys = this.settingsService.settings.Hotkeys;
    const bubbleKeys = [];
    // create search strings for the defined hot keys that need to bubble out of the editor
    // transforms control.x, alt.x, etc. to ctrl+X, alt+X, etc.
    for (const [key, hk] of Object.entries(hotKeys)) {
      const parts = (hk as any).keys.split('.');
      if (parts.length === 2) {
        if (parts[0] === 'control') parts[0] = 'ctrl';
        bubbleKeys.push(parts[0] + '+' + parts[1].toUpperCase());
      }
    }
    // get the editor default key bindings
    const bindings =
      editor._standaloneKeybindingService._getResolver()._defaultKeybindings;
    // set the editor key bindings to bubble the defined hot keys that would be intercepted
    // by clearing the command and setting bubble to true
    bindings.forEach((binding) => {
      if (
        binding.keypressParts.length === 1 &&
        bubbleKeys.some((bk) => bk === binding.keypressParts[0])
      ) {
        binding.command = '';
        binding.bubble = true;
      }
    });
  }

  updateEditorOptions(file: ModelFile): void {
    let writable = false;

    if (file && this.currentUserId) {
      writable = file.lockedById === this.currentUserId;
    }

    const options = {
      theme: this.codeTheme === Theme.DARK ? 'vs-dark' : 'vs-light',
      language: 'ruby',
      automaticLayout: true,
      readOnly: !writable,
    };
    this.editorOptions = Object.assign({}, { ...options });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.file && !changes.file.firstChange) {
      this.code = changes.file.currentValue.editorContent;
      this.changeDetectorRef.markForCheck();
    }
    if (this.breadcrumb && this.breadcrumb.length > 0) {
      this.breadcrumbString = '';
      this.breadcrumb.forEach((bc) => {
        this.breadcrumbString = this.breadcrumbString + '  >  ' + bc.name;
      });
    }
  }

  codeChangedEventHandler(event) {
    if (event !== this.file.editorContent) {
      this.fileService.updateEditorContent(this.file.id, this.code);
    }
  }

  saveFile() {
    this.fileService
      .updateFileContent(this.file.id, this.file.editorContent)
      .pipe(take(1))
      .subscribe(() => {
        this.fileVersionService.load(this.file.id).pipe(take(1)).subscribe();
      });
  }

  discardFileChanges() {
    this.fileService.updateEditorContent(this.file.id, this.file.content);
  }

  insertModuleFn(event) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService
      .createVersionSnippet(event)
      .pipe(take(1))
      .subscribe((snippet) => {
        this.code = this.code + '\n' + snippet + '\n';
        this.changeDetectorRef.markForCheck();
      });
  }

  getModuleFn(event) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.loadModuleById(event.id).pipe(take(1)).subscribe();
    this.selectedModule$ = this.moduleQuery.selectByModuleId(event.id);
  }

  getVersionFn(event) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.fileVersionService
      .loadFileVersionById(event.id)
      .pipe(take(1))
      .subscribe();
    if (
      this.selectedVersionForDiff &&
      event.id === this.selectedVersionForDiff.id
    ) {
      this.fileService.setSelectedVersionId(this.file.id, '');
    } else {
      this.fileService.setSelectedVersionId(this.file.id, event.id);
    }
  }

  revertToVersionFn(event) {
    this.fileVersionService
      .loadFileVersionById(event.fileVersion.id)
      .pipe(take(1))
      .subscribe((file) => {
        if (file.content === null || file.content === '') {
          const data = { buttonTrueText: '', buttonFalseText: 'Ok' };
          this.confirmDialog
            .confirmDialog(
              'No Content',
              'This version has no content.  Revert canceled.',
              data
            )
            .pipe(take(1))
            .subscribe();
        } else {
          if (this.isEditing) {
            this.confirmDialog
              .confirmDialog(
                'Revert?',
                'Are you sure that you want to overwrite the current file?'
              )
              .pipe(take(1))
              .subscribe((result) => {
                if (!result[this.confirmDialog.WAS_CANCELLED]) {
                  this.code = file.content;
                  this.fileService.updateEditorContent(this.file.id, this.code);
                  this.changeDetectorRef.markForCheck();
                  if (this.selectedVersionForDiff) {
                    this.fileService.setSelectedVersionId(this.file.id, '');
                  }
                  this.saveFile();
                }
              });
          } else {
            const data = { buttonTrueText: '', buttonFalseText: 'Ok' };
            this.confirmDialog
              .confirmDialog(
                'Not in Edit Mode',
                'The current file must be in edit mode to revert.',
                data
              )
              .pipe(take(1))
              .subscribe();
          }
        }
      });
  }

  sidebarChangedFn(event, tostate) {
    if (event) {
      switch (event) {
        case 'versions': {
          this.sidebarViewChanged.emit(event);
          break;
        }
        case 'modules': {
          this.sidebarViewChanged.emit(event);
          this.fileService.setSelectedVersionId(this.file.id, '');
        }
      }
    }
    this.sidebarChanged.emit(tostate);
  }

  toggleSidebar($event, tostate) {
    if (this.sidebarOpen !== tostate) {
      this.sidebarChanged.emit(tostate);
    }
  }

  resetSidebar() {
    this.sidebarChanged.emit(false);
    this.sidebarViewChanged.emit('');
  }

  resizingFn(event) {
    this.sidenavWidth = Math.max(event.rectangle.width, SIDEBAR_MIN_WIDTH);
  }

  resizeEndFn(event) {
    this.sidenavWidthChanged.emit(
      Math.max(event.rectangle.width, SIDEBAR_MIN_WIDTH)
    );
  }

  lockFile() {
    this.fileService.lockFile(this.file.id);
  }

  unlockFile() {
    this.fileService.unlockFile(this.file.id);
  }

  adminLockFile() {
    this.fileService.adminLockFile(this.file.id);
  }

  adminUnlockFile() {
    this.fileService.adminUnlockFile(this.file.id);
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
