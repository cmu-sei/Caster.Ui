/*
Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Inject, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { DiffEditorComponent, EditorComponent } from 'ngx-monaco-editor-v2';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  Theme,
} from '@cmusei/crucible-common';
import { CurrentUserQuery } from 'src/app/users/state';
import {
  AiTerraformDraft,
  AiTerraformFile,
  FilesService,
  ModelFile,
} from 'src/app/generated/caster-api';

export interface AiTerraformDraftDialogData {
  directoryId: string;
  directoryName: string;
  /** The file the designer has open, which the draft changes first */
  fileId?: string;
  fileName?: string;
}

/** A drafted file as the designer reviews it. */
export interface DraftFileRow {
  file: AiTerraformFile;
  keep: boolean;
}

/**
 * Drafts Terraform for a directory with AI, or a change to the file the designer has open. Drafting saves
 * nothing: the designer reviews each file, a replaced one as a diff, and Apply saves the kept files together.
 * A file that changed since the draft, or that another user holds, stops the whole apply.
 */
@Component({
  selector: 'cas-ai-terraform-draft-dialog',
  templateUrl: './ai-terraform-draft-dialog.component.html',
  styleUrls: ['./ai-terraform-draft-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    MatButton,
    MatCheckbox,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatFormField,
    MatLabel,
    MatInput,
    MatIcon,
    DiffEditorComponent,
    EditorComponent,
  ],
})
export class AiTerraformDraftDialogComponent {
  step: 'prompt' | 'review' = 'prompt';
  prompt = '';
  loading = false;
  errorMessage = '';
  draft: AiTerraformDraft;
  rows: DraftFileRow[] = [];

  // the code follows the designer's light or dark theme, as the file editor's does
  editorOptions = { theme: 'vs-light', readOnly: true, automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AiTerraformDraftDialogData,
    private dialogRef: MatDialogRef<AiTerraformDraftDialogComponent, ModelFile[]>,
    private filesService: FilesService
  ) {
    inject(CurrentUserQuery)
      .userTheme$.pipe(takeUntilDestroyed())
      .subscribe((theme) => {
        this.editorOptions = { ...this.editorOptions, theme: theme === Theme.DARK ? 'vs-dark' : 'vs-light' };
        (window as any).monaco?.editor.setTheme(this.editorOptions.theme);
      });
  }

  get canDraft(): boolean {
    return !!this.prompt.trim() && !this.loading;
  }

  get kept(): DraftFileRow[] {
    return this.rows.filter((r) => r.keep);
  }

  get submitLabel(): string {
    const count = this.kept.length;
    return this.step === 'prompt' ? 'Draft' : `Apply ${count} ${count === 1 ? 'file' : 'files'}`;
  }

  get submitDisabled(): boolean {
    return this.step === 'prompt' ? !this.canDraft : !this.kept.length || this.loading;
  }

  submit() {
    if (this.step === 'prompt') {
      this.draftFiles();
    } else {
      this.apply();
    }
  }

  draftFiles() {
    this.loading = true;
    this.errorMessage = '';
    this.filesService
      .draftTerraformWithAi(this.data.directoryId, { prompt: this.prompt, fileId: this.data.fileId ?? null })
      .pipe(take(1))
      .subscribe({
        next: (draft) => {
          this.draft = draft;
          this.rows = (draft.files ?? []).map((file) => ({ file, keep: true }));
          this.step = 'review';
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = this.getErrorMessage(err, 'The draft failed.');
          this.loading = false;
        },
      });
  }

  apply() {
    this.loading = true;
    this.errorMessage = '';
    this.filesService
      .applyAiTerraformDraft(this.data.directoryId, {
        files: this.kept.map(({ file }) => ({
          name: file.name,
          content: file.content,
          existingFileId: file.existingFileId ?? null,
          existingContentHash: file.existingContentHash ?? null,
        })),
      })
      .pipe(take(1))
      .subscribe({
        // the answer leaves out content, as file lists do; the open editor needs what was saved
        next: (files) =>
          this.dialogRef.close(
            files.map((saved) => {
              const content = this.kept.find((r) => r.file.name === saved.name)?.file.content ?? saved.content;
              return { ...saved, content, editorContent: content };
            })
          ),
        error: (err) => {
          this.errorMessage = this.getErrorMessage(err, 'The files could not be saved.');
          this.loading = false;
        },
      });
  }

  // back to the description, keeping it so the designer can reword and draft again
  startOver() {
    this.step = 'prompt';
    this.draft = undefined;
    this.rows = [];
    this.errorMessage = '';
  }

  language(name: string): string {
    return /\.(tf|tfvars)$/i.test(name) ? 'hcl' : /\.ya?ml$/i.test(name) ? 'yaml' : /\.sh$/i.test(name) ? 'shell' : 'plaintext';
  }

  close() {
    this.dialogRef.close();
  }

  private getErrorMessage(err: any, fallback: string): string {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      return 'The API could not be reached.';
    }
    const title = err?.error?.title;
    const detail = err?.error?.detail;
    if (title) {
      return detail && detail !== title ? `${title} ${detail}` : title;
    }
    return err?.message || fallback;
  }
}
