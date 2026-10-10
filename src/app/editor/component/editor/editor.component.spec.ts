// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { ResizableModule } from 'angular-resizable-element';
import { FileStore } from 'src/app/files/state/file.store';
import {
  FilesService,
  FileVersion,
  ModelFile,
  Module,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CurrentUserStore } from 'src/app/users/state/user.store';
import { EditorComponent } from './editor.component';

@Component({
  selector: 'ngx-monaco-editor',
  template: '',
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MonacoEditorStub),
      multi: true,
    },
  ],
})
class MonacoEditorStub implements ControlValueAccessor {
  @Input() options: unknown;
  @Output() onInit = new EventEmitter<unknown>();
  writeValue(): void {}
  registerOnChange(): void {}
  registerOnTouched(): void {}
}

@Component({
  selector: 'ngx-monaco-diff-editor',
  template: '',
  standalone: false,
})
class MonacoDiffEditorStub {
  @Input() options: unknown;
  @Input() originalModel: unknown;
  @Input() modifiedModel: unknown;
}

@Component({ selector: 'cas-module-list', template: '', standalone: false })
class ModuleListStub {
  @Input() modules: Module[];
  @Input() selectedModule: Module;
  @Input() isEditing: boolean;
  @Output() getModule = new EventEmitter<{ id: string; name: string }>();
  @Output() insertModule = new EventEmitter<unknown>();
}

@Component({ selector: 'cas-version-list', template: '', standalone: false })
class VersionListStub {
  @Input() fileId: string;
  @Input() selectedVersionId: string;
  @Output() getVersion = new EventEmitter<FileVersion>();
  @Output() revertToVersion = new EventEmitter<unknown>();
}

interface Gates {
  canEdit?: boolean;
  canAdminLock?: boolean;
  canManage?: boolean;
}

async function renderEditor(gates: Gates, file: Partial<ModelFile> = {}) {
  const filesApi = {
    getFileVersions: vi.fn((_fileId: string) => of<FileVersion[]>([])),
    lockFile: vi.fn((id: string) => of<ModelFile>({ id, lockedById: 'u1' })),
    administrativelyLockFile: vi.fn((id: string) =>
      of<ModelFile>({ id, administrativelyLocked: true }),
    ),
    forceUnlockFile: vi.fn((id: string) => of<ModelFile>({ id })),
  } satisfies ApiStub<FilesService>;
  const { dialogRef } = dialogRefStub<unknown, boolean>(true);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(EditorComponent, {
    declarations: [
      MonacoEditorStub,
      MonacoDiffEditorStub,
      ModuleListStub,
      VersionListStub,
    ],
    imports: [
      MatSidenavModule,
      MatToolbarModule,
      MatButtonModule,
      MatIconModule,
      MatTooltipModule,
      MatDividerModule,
      ResizableModule,
    ],
    providers: [
      { provide: FilesService, useValue: filesApi },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
    inputs: {
      fileId: 'f1',
      modules: [],
      sidebarOpen: false,
      sidebarView: '',
      breadcrumb: [],
      sidenavWidth: 300,
      canEdit: false,
      canAdminLock: false,
      canManage: false,
      ...gates,
    },
  });
  TestBed.inject(CurrentUserStore).update({ id: 'u1', name: 'Ada' });
  const store = TestBed.inject(FileStore);
  store.set([
    {
      id: 'f1',
      name: 'main.tf',
      content: 'old',
      editorContent: 'new',
      administrativelyLocked: false,
      lockedById: null,
      ...file,
    },
  ]);
  store.ui.update('f1', { isSaved: false });
  view.fixture.detectChanges();
  return { ...view, filesApi, confirm, user: userEvent.setup() };
}

describe('EditorComponent', () => {
  /**
   * Verifies: with canEdit, Save, Discard and Edit this file are enabled, and Edit this file locks the file for the user.
   * Interacts with: FilesService.lockFile (stub), real FileService, FileQuery and CurrentUserQuery.
   * Data: unlocked main.tf with unsaved changes; canEdit true.
   */
  it('lets an editor save, discard and lock the file when canEdit is true', async () => {
    const { filesApi, user } = await renderEditor({ canEdit: true });

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Discard Changes' }),
    ).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Edit this file' }));

    expect(filesApi.lockFile).toHaveBeenCalledWith('f1');
  });

  /**
   * Verifies: without canEdit, Save, Discard and Edit this file are disabled even with unsaved changes.
   * Interacts with: the !canEdit bindings in the toolbar.
   * Data: unlocked main.tf with unsaved changes; near miss: canAdminLock and canManage true, canEdit false.
   */
  it('disables Save, Discard and Edit without canEdit', async () => {
    await renderEditor({ canEdit: false, canAdminLock: true, canManage: true });

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Discard Changes' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit this file' }),
    ).toBeDisabled();
  });

  /**
   * Verifies: with canAdminLock the administrative lock button is enabled and locks the file.
   * Interacts with: FilesService.administrativelyLockFile (stub).
   * Data: main.tf not administratively locked; canAdminLock true.
   */
  it('administratively locks the file with canAdminLock', async () => {
    const { filesApi, user } = await renderEditor({ canAdminLock: true });

    await user.click(
      screen.getByRole('button', { name: 'Administratively Lock File' }),
    );

    expect(filesApi.administrativelyLockFile).toHaveBeenCalledWith('f1');
  });

  /**
   * Verifies: without canAdminLock the administrative lock button is disabled, also for a user who can edit and manage.
   * Interacts with: the [disabled]="!canAdminLock" binding.
   * Data: main.tf not administratively locked; near miss: canEdit and canManage true, canAdminLock false.
   */
  it('disables the administrative lock without canAdminLock', async () => {
    await renderEditor({ canEdit: true, canManage: true, canAdminLock: false });

    expect(
      screen.getByRole('button', { name: 'Administratively Lock File' }),
    ).toBeDisabled();
  });

  /**
   * Verifies: with canManage, a file another user is editing offers Force release, which confirms and force-unlocks it.
   * Interacts with: CrucibleDialogService.confirm (stub answering true), FilesService.forceUnlockFile (stub).
   * Data: main.tf locked by Grace (u2); canManage true.
   */
  it('force-releases a file locked by another user with canManage', async () => {
    const { filesApi, confirm, user } = await renderEditor(
      { canManage: true },
      { lockedById: 'u2', lockedByName: 'Grace' },
    );

    await user.click(
      screen.getByRole('button', { name: 'Force release the file from Grace' }),
    );

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(filesApi.forceUnlockFile).toHaveBeenCalledWith('f1');
  });

  /**
   * Verifies: without canManage, a file another user is editing only says who is editing it, and clicking does nothing.
   * Interacts with: the canManage check in the lock button's label and click handler.
   * Data: main.tf locked by Grace (u2); near miss: canEdit and canAdminLock true, canManage false.
   */
  it('hides Force release without canManage', async () => {
    const { filesApi, confirm, user } = await renderEditor(
      { canEdit: true, canAdminLock: true, canManage: false },
      { lockedById: 'u2', lockedByName: 'Grace' },
    );

    expect(
      screen.queryByRole('button', { name: /Force release/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'This file is being edited by Grace',
      }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(filesApi.forceUnlockFile).not.toHaveBeenCalled();
  });
});
