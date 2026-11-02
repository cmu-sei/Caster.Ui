// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { take } from 'rxjs/operators';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { DiffEditorComponent, EditorComponent } from 'ngx-monaco-editor-v2';
import { Theme } from '@cmusei/crucible-common';
import {
  AiAssistChange,
  AiAssistChangeResult,
  AiAssistMessage,
  AiAssistService,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { DirectoryQuery } from 'src/app/directories/state';
import {
  FileQuery,
  FileService,
  isFileContentChanged,
} from 'src/app/files/state';
import { WorkspaceQuery, WorkspaceService } from 'src/app/workspace/state';
import { CurrentUserQuery } from 'src/app/users/state';

/** A proposed change as the planner reviews it. */
export interface AssistChangeRow {
  change: AiAssistChange;
  keep: boolean;
  /** Whether the change's diff or new file is shown */
  open: boolean;
}

/** One turn of the conversation, with what was proposed and what came of applying it. */
export interface AssistTurn {
  role: 'planner' | 'assistant';
  text: string;
  question?: string;
  cause?: string;
  changes?: AssistChangeRow[];
  warnings?: string[];
  results?: AiAssistChangeResult[];
  error?: string;
}

/**
 * Ask AI: a panel beside the project where the planner asks for changes to one directory's files and workspaces in
 * words, reviews each proposed change (a file as a diff), and applies the ones they keep. Asking saves nothing; the
 * conversation is resent with each request, so a follow-up can refer to what came before. Changing the directory
 * starts a new conversation.
 */
@Component({
  selector: 'cas-project-assistant',
  templateUrl: './project-assistant.component.html',
  styleUrls: ['./project-assistant.component.scss'],
  imports: [
    FormsModule,
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatIcon,
    MatInput,
    MatSelect,
    MatOption,
    MatProgressSpinner,
    DiffEditorComponent,
    EditorComponent,
  ],
})
export class ProjectAssistantComponent {
  private aiAssistService = inject(AiAssistService);
  private workspacesService = inject(WorkspacesService);
  private directoryQuery = inject(DirectoryQuery);
  private workspaceQuery = inject(WorkspaceQuery);
  private fileQuery = inject(FileQuery);
  private fileService = inject(FileService);
  private workspaceService = inject(WorkspaceService);

  readonly projectId = input.required<string>();
  /** The directory of the open tab, which the panel follows until a conversation starts */
  readonly directoryId = input<string>();
  /** The workspace of the open tab, if it is one */
  readonly workspaceId = input<string>();
  readonly closePanel = output<void>();

  private readonly allDirectories = toSignal(this.directoryQuery.selectAll(), {
    initialValue: [],
  });
  private readonly allWorkspaces = toSignal(this.workspaceQuery.selectAll(), {
    initialValue: [],
  });

  /** The project's directories, each by its path */
  readonly directories = computed(() => {
    const all = this.allDirectories().filter(
      (d) => d.projectId === this.projectId(),
    );
    const byId = new Map(all.map((d) => [d.id, d]));
    const path = (id: string, seen = new Set<string>()): string => {
      const d = byId.get(id);
      if (!d) return '';
      if (!d.parentId || seen.has(d.parentId) || !byId.has(d.parentId))
        return d.name;
      seen.add(id);
      return `${path(d.parentId, seen)} / ${d.name}`;
    };
    return all
      .map((d) => ({ id: d.id, label: path(d.id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly selectedDirectoryId = signal<string | undefined>(undefined);
  /** The workspace whose runs the model is shown; empty for every workspace of the directory */
  readonly selectedWorkspaceId = signal<string>('');

  readonly workspaces = computed(() =>
    this.allWorkspaces()
      .filter((w) => w.directoryId === this.selectedDirectoryId())
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
  );

  turns: AssistTurn[] = [];
  prompt = '';
  isAsking = false;
  isApplying = false;

  readonly examples = [
    'Fix the errors from the last plan or apply',
    'Why did the last run fail?',
    'Add a variable for the VM template and use it in main.tf',
    'Move the network resources into their own file',
    'Which Terraform version does this directory need?',
  ];

  // the code follows the planner's light or dark theme, as the file editor's does
  editorOptions = {
    theme: 'vs-light',
    readOnly: true,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderSideBySide: false,
  };

  constructor() {
    inject(CurrentUserQuery)
      .userTheme$.pipe(takeUntilDestroyed())
      .subscribe((theme) => {
        this.editorOptions = {
          ...this.editorOptions,
          theme: theme === Theme.DARK ? 'vs-dark' : 'vs-light',
        };
        (window as any).monaco?.editor.setTheme(this.editorOptions.theme);
      });

    // the panel follows the open tab until the planner starts a conversation, which stays on its directory
    effect(() => {
      const directoryId = this.directoryId();
      const workspaceId = this.workspaceId();
      const directories = this.directories();
      untracked(() => {
        if (this.turns.length) {
          return;
        }
        if (directoryId) {
          this.selectedDirectoryId.set(directoryId);
          this.selectedWorkspaceId.set(workspaceId ?? '');
        } else if (
          !directories.some((d) => d.id === this.selectedDirectoryId())
        ) {
          this.selectedDirectoryId.set(directories[0]?.id);
          this.selectedWorkspaceId.set('');
        }
      });
    });
  }

  get canAsk(): boolean {
    return (
      !!this.prompt.trim() &&
      !!this.selectedDirectoryId() &&
      !this.isAsking &&
      !this.isApplying
    );
  }

  /** A conversation is about one directory; another directory starts a new one */
  selectDirectory(directoryId: string) {
    if (directoryId === this.selectedDirectoryId()) {
      return;
    }
    this.selectedDirectoryId.set(directoryId);
    this.selectedWorkspaceId.set('');
    this.newConversation();
  }

  newConversation() {
    this.turns = [];
    this.prompt = '';
  }

  ask(text = this.prompt) {
    text = text.trim();
    const directoryId = this.selectedDirectoryId();
    if (!text || !directoryId || this.isAsking) {
      return;
    }
    const history: AiAssistMessage[] = this.turns.map((t) => ({
      role: t.role,
      text: this.historyText(t),
    }));
    this.turns.push({ role: 'planner', text });
    this.prompt = '';
    this.isAsking = true;
    this.aiAssistService
      .askAiAssistant(directoryId, {
        prompt: text,
        workspaceId: this.selectedWorkspaceId() || null,
        history,
      })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          this.turns.push({
            role: 'assistant',
            text: result.reply || '',
            question: result.question || undefined,
            cause: result.cause || undefined,
            // a file change opens on its diff when it is the only change
            changes: (result.changes ?? []).map((change, _, all) => ({
              change,
              keep: true,
              open: all.length === 1 && this.isFile(change),
            })),
            warnings: result.warnings ?? [],
          });
          this.isAsking = false;
        },
        error: (err) => {
          this.turns.push({
            role: 'assistant',
            text: '',
            error: this.getErrorMessage(err, 'The request failed.'),
          });
          this.isAsking = false;
        },
      });
  }

  keptChanges(turn: AssistTurn): AiAssistChange[] {
    return (turn.changes ?? []).filter((c) => c.keep).map((c) => c.change);
  }

  apply(turn: AssistTurn) {
    const changes = this.keptChanges(turn);
    const directoryId = this.selectedDirectoryId();
    if (!changes.length || !directoryId || this.isApplying) {
      return;
    }
    this.isApplying = true;
    this.aiAssistService
      .applyAiAssistantChanges(directoryId, { changes })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          turn.results = result.results ?? [];
          this.isApplying = false;
          this.reload(directoryId, turn.results);
        },
        error: (err) => {
          turn.error = this.getErrorMessage(
            err,
            'The changes could not be applied.',
          );
          this.isApplying = false;
        },
      });
  }

  isFile(change: AiAssistChange): boolean {
    return change.op === 'file.add' || change.op === 'file.edit';
  }

  language(name: string): string {
    return /\.(tf|tfvars)$/i.test(name ?? '')
      ? 'hcl'
      : /\.ya?ml$/i.test(name ?? '')
        ? 'yaml'
        : /\.sh$/i.test(name ?? '')
          ? 'shell'
          : 'plaintext';
  }

  onKeydown(event: KeyboardEvent) {
    // Enter sends; Shift+Enter starts a new line
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.canAsk) {
        this.ask();
      }
    }
  }

  // what the model reads of an earlier turn: the reply, and what was proposed and applied
  private historyText(turn: AssistTurn): string {
    if (turn.role === 'planner') {
      return turn.text;
    }
    const parts = [turn.text, turn.question, turn.error];
    const proposed = (turn.changes ?? []).map((c) => c.change.label);
    if (proposed.length) {
      parts.push(`Proposed: ${proposed.join('; ')}.`);
    }
    if (turn.results?.length) {
      parts.push(
        'Applied: ' +
          turn.results
            .map((r) =>
              r.applied ? r.label : `${r.label} (not applied: ${r.error})`,
            )
            .join('; ') +
          '.',
      );
    }
    return parts.filter(Boolean).join(' ');
  }

  // the files and workspaces the changes touched, so the open tabs and lists show them; an open file with unsaved
  // edits keeps them
  private reload(directoryId: string, results: AiAssistChangeResult[]) {
    const applied = results.filter((r) => r.applied);
    if (applied.some((r) => r.op === 'file.add')) {
      this.fileService
        .loadFilesByDirectory(directoryId)
        .pipe(take(1))
        .subscribe();
    }
    for (const result of applied.filter(
      (r) => r.op === 'file.edit' && r.fileId,
    )) {
      if (!isFileContentChanged(this.fileQuery.getEntity(result.fileId))) {
        this.fileService.loadFile(result.fileId).pipe(take(1)).subscribe();
      }
    }
    for (const result of applied.filter(
      (r) => r.op === 'workspace.version' && r.workspaceId,
    )) {
      this.workspacesService
        .getWorkspace(result.workspaceId)
        .pipe(take(1))
        .subscribe((workspace) => this.workspaceService.updated(workspace));
    }
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
