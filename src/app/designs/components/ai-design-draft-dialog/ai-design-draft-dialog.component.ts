// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, Inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { take } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  AiDesignDraft,
  AiDraftModule,
  Design,
  DesignsService,
  ModuleValue,
} from 'src/app/generated/caster-api';

export interface AiDesignDraftDialogData {
  directoryId: string;
  directoryName: string;
}

/** A drafted module as the planner edits it before the Design is created. */
export interface DraftModuleRow {
  moduleId: string;
  moduleName: string;
  moduleVersion: string;
  hypervisor: string;
  source: string;
  name: string;
  purpose: string;
  values: ModuleValue[];
  required: string[];
}

/** The hypervisor choice that targets every configured hypervisor at once. */
export const BOTH_HYPERVISORS = 'Both';

// The Terraform name rule DesignModuleValidation enforces.
const TERRAFORM_NAME = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

// The placeholder the API recognizes (Placeholders.cs): a value the planner still has to supply.
const PLACEHOLDER = /\bREPLACE_WITH_[A-Za-z0-9_]*/;

/** Whether a value is, or contains, a placeholder the planner must replace before enabling. */
export function isPlaceholder(value: string): boolean {
  return !!value && PLACEHOLDER.test(value);
}

/**
 * Drafts a Design with AI from the module catalog. Drafting saves nothing: the planner
 * reviews the modules and values and only then creates the Design, disabled. A value the
 * model could not know is saved as a placeholder, and the Design cannot be enabled, so no
 * Workspace picks it up, until every placeholder is replaced.
 */
@Component({
  selector: 'cas-ai-design-draft-dialog',
  templateUrl: './ai-design-draft-dialog.component.html',
  styleUrls: ['./ai-design-draft-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    MatButton,
    MatIconButton,
    MatCard,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
    MatTooltip,
  ],
})
export class AiDesignDraftDialogComponent implements OnInit {
  step: 'prompt' | 'review' = 'prompt';
  prompt = '';
  designName = '';
  /** Hypervisors Terraform runs can build on; null until the server answers. */
  configuredHypervisors: string[] = null;
  hypervisor = BOTH_HYPERVISORS;
  readonly both = BOTH_HYPERVISORS;
  loading = false;
  errorMessage = '';

  draft: AiDesignDraft;
  modules: DraftModuleRow[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AiDesignDraftDialogData,
    private dialogRef: MatDialogRef<AiDesignDraftDialogComponent, Design>,
    private designsService: DesignsService
  ) {}

  ngOnInit() {
    this.designsService
      .getAiDesignDraftOptions(this.data.directoryId)
      .pipe(take(1))
      .subscribe({
        next: (options) => {
          this.configuredHypervisors = options.configuredHypervisors ?? [];
          if (!options.enabled) this.errorMessage = 'AI drafting is not enabled on this server.';
        },
        // the draft still works without the options; the server then targets every configured hypervisor
        error: () => (this.configuredHypervisors = null),
      });
  }

  /** The hypervisors the draft asks for; empty lets the server use every configured one. */
  get requestedHypervisors(): string[] {
    if (!this.configuredHypervisors?.length || this.hypervisor === BOTH_HYPERVISORS) return [];
    return [this.hypervisor];
  }

  get submitLabel(): string {
    return this.step === 'prompt' ? 'Draft' : 'Create Design';
  }

  get loadingLabel(): string {
    return this.step === 'prompt' ? 'Drafting...' : 'Creating...';
  }

  get submitDisabled(): boolean {
    return this.step === 'prompt'
      ? !this.prompt.trim()
      : this.reviewProblems().length > 0;
  }

  submit() {
    if (this.submitDisabled || this.loading) return;
    if (this.step === 'prompt') {
      this.draftDesign();
    } else {
      this.createDesign();
    }
  }

  cancel() {
    this.dialogRef.close();
  }

  /** Back to the prompt; the next draft replaces this one. */
  redraft() {
    this.step = 'prompt';
    this.errorMessage = '';
  }

  draftDesign() {
    this.loading = true;
    this.errorMessage = '';
    this.designsService
      .draftDesignWithAi(this.data.directoryId, {
        prompt: this.prompt.trim(),
        designName: this.designName.trim() || null,
        hypervisors: this.requestedHypervisors,
      })
      .pipe(take(1))
      .subscribe({
        next: (draft) => {
          this.loading = false;
          this.draft = draft;
          this.designName = draft.designName || this.designName;
          this.modules = (draft.modules ?? []).map(toRow);
          this.step = 'review';
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = errorText(err);
        },
      });
  }

  createDesign() {
    this.loading = true;
    this.errorMessage = '';
    this.designsService
      .createDesignFromAiDraft(this.data.directoryId, {
        name: this.designName.trim(),
        modules: this.modules.map((m) => ({
          moduleId: m.moduleId,
          name: m.name.trim(),
          moduleVersion: m.moduleVersion,
          // an optional variable left blank is left out, so the module's default applies;
          // a required one left blank is saved as a placeholder
          values: m.values
            .filter((v) => v.value?.trim() || m.required.includes(v.name))
            .map((v) => ({ name: v.name, value: v.value })),
        })),
      })
      .pipe(take(1))
      .subscribe({
        next: (design) => {
          this.loading = false;
          this.dialogRef.close(design);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = errorText(err);
        },
      });
  }

  removeModule(row: DraftModuleRow) {
    this.modules = this.modules.filter((m) => m !== row);
  }

  isRequired(row: DraftModuleRow, value: ModuleValue): boolean {
    return row.required.includes(value.name);
  }

  isMissing(row: DraftModuleRow, value: ModuleValue): boolean {
    return this.isRequired(row, value) && !value.value?.trim();
  }

  isPlaceholder(value: ModuleValue): boolean {
    return isPlaceholder(value.value);
  }

  /** The values each module still needs before the Design can be enabled: blanks and placeholders. */
  toFinish(): string[] {
    const items: string[] = [];
    for (const row of this.modules) {
      const names = row.values
        .filter((v) => this.isMissing(row, v) || this.isPlaceholder(v))
        .map((v) => v.name);
      if (names.length) items.push(`${row.name || row.moduleName}: ${names.join(', ')}`);
    }
    return items;
  }

  nameProblem(row: DraftModuleRow): string {
    const name = row.name.trim();
    if (!name) return 'Name is required';
    if (!TERRAFORM_NAME.test(name))
      return 'Start with a letter or underscore; use only letters, digits, underscores and dashes';
    if (this.modules.filter((m) => m.name.trim() === name).length > 1)
      return 'Another module has this name';
    return '';
  }

  /**
   * What stops the Design from being created, in the order a planner would fix it. Values
   * still to fill do not: they are saved as placeholders and block enabling instead.
   */
  reviewProblems(): string[] {
    const problems: string[] = [];
    if (!this.designName.trim()) problems.push('The design needs a name.');
    if (this.modules.length === 0) problems.push('The design needs at least one module.');
    for (const row of this.modules) {
      if (this.nameProblem(row)) problems.push(`${row.name || row.moduleName}: ${this.nameProblem(row)}.`);
    }
    return problems;
  }
}

/** Every drafted value, then a blank row for each required variable the model left out. */
function toRow(m: AiDraftModule): DraftModuleRow {
  const values = (m.values ?? []).map((v) => ({ name: v.name, value: v.value ?? '' }));
  const required = m.missingRequiredVariables ?? [];
  for (const name of required) {
    if (!values.some((v) => v.name === name)) values.push({ name, value: '' });
  }
  return {
    moduleId: m.moduleId,
    moduleName: m.moduleName,
    moduleVersion: m.moduleVersion,
    hypervisor: m.hypervisor ?? null,
    source: m.source ?? null,
    name: m.name ?? '',
    purpose: m.purpose ?? '',
    values,
    required,
  };
}

/** The API's problem details as one line per message; the dialog stays open to fix them. */
export function errorText(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
    const details = err.error;
    const messages: string[] = [];
    if (details.errors) {
      for (const key of Object.keys(details.errors)) messages.push(...[].concat(details.errors[key]));
    }
    if (details.detail) messages.push(details.detail);
    if (messages.length) return messages.join('\n');
    if (details.title) return details.title;
  }
  if (err instanceof HttpErrorResponse) return `${err.status} ${err.statusText}`.trim();
  return 'Something went wrong. Try again.';
}
