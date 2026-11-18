// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AiUsageRefreshService } from 'src/app/shared/utilities/ai-usage-refresh.service';
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
import { aiErrorMessage } from 'src/app/shared/utilities/ai-error-message';
import { FormsModule } from '@angular/forms';
import { take, finalize } from 'rxjs/operators';
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
import { FileQuery, FileService } from 'src/app/files/state';
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
  private aiUsage = inject(AiUsageRefreshService);
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

  // signals, so an answer arriving after the request redraws the panel inside the OnPush project page
  readonly turns = signal<AssistTurn[]>([]);
  prompt = '';
  readonly isAsking = signal(false);
  readonly isApplying = signal(false);

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
        // Monaco puts itself on window when it loads
        (
          window as unknown as {
            monaco?: { editor: { setTheme(name: string): void } };
          }
        ).monaco?.editor.setTheme(this.editorOptions.theme);
      });

    // the panel follows the open tab until the planner starts a conversation, which stays on its directory
    effect(() => {
      const directoryId = this.directoryId();
      const workspaceId = this.workspaceId();
      const directories = this.directories();
      untracked(() => {
        if (this.turns().length) {
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
      !this.isAsking() &&
      !this.isApplying()
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
    this.turns.set([]);
    this.prompt = '';
  }

  ask(text = this.prompt) {
    text = text.trim();
    const directoryId = this.selectedDirectoryId();
    if (!text || !directoryId || this.isAsking()) {
      return;
    }
    const history: AiAssistMessage[] = this.turns().map((t) => ({
      role: t.role,
      text: this.historyText(t),
    }));
    this.addTurn({ role: 'planner', text });
    this.prompt = '';
    this.isAsking.set(true);
    this.aiAssistService
      .askAiAssistant(directoryId, {
        prompt: text,
        workspaceId: this.selectedWorkspaceId() || null,
        history,
      })
      .pipe(
        take(1),
        finalize(() => this.aiUsage.called()),
      )
      .subscribe({
        next: (result) => {
          this.addTurn({
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
          this.isAsking.set(false);
        },
        error: (err) => {
          this.addTurn({
            role: 'assistant',
            text: '',
            error: aiErrorMessage(err, 'The request failed.'),
          });
          this.isAsking.set(false);
        },
      });
  }

  keptChanges(turn: AssistTurn): AiAssistChange[] {
    return (turn.changes ?? []).filter((c) => c.keep).map((c) => c.change);
  }

  /** Keeps or leaves out one proposed change */
  setKeep(turnIndex: number, rowIndex: number, keep: boolean) {
    this.updateRow(turnIndex, rowIndex, { keep });
  }

  /** Shows or hides one proposed change's diff or new file */
  toggleOpen(turnIndex: number, rowIndex: number) {
    const row = this.turns()[turnIndex]?.changes?.[rowIndex];
    if (row) {
      this.updateRow(turnIndex, rowIndex, { open: !row.open });
    }
  }

  apply(turnIndex: number) {
    const turn = this.turns()[turnIndex];
    const changes = turn ? this.keptChanges(turn) : [];
    const directoryId = this.selectedDirectoryId();
    if (!changes.length || !directoryId || this.isApplying()) {
      return;
    }
    this.isApplying.set(true);
    this.aiAssistService
      .applyAiAssistantChanges(directoryId, { changes })
      .pipe(take(1))
      .subscribe({
        next: (result) => {
          const results = result.results ?? [];
          this.updateTurn(turnIndex, { results });
          this.isApplying.set(false);
          this.reload(directoryId, results);
        },
        error: (err) => {
          this.updateTurn(turnIndex, {
            error: aiErrorMessage(err, 'The changes could not be applied.'),
          });
          this.isApplying.set(false);
        },
      });
  }

  private addTurn(turn: AssistTurn) {
    this.turns.update((turns) => [...turns, turn]);
  }

  private updateTurn(turnIndex: number, patch: Partial<AssistTurn>) {
    this.turns.update((turns) =>
      turns.map((t, i) => (i === turnIndex ? { ...t, ...patch } : t)),
    );
  }

  private updateRow(
    turnIndex: number,
    rowIndex: number,
    patch: Partial<AssistChangeRow>,
  ) {
    const changes = this.turns()[turnIndex]?.changes?.map((row, i) =>
      i === rowIndex ? { ...row, ...patch } : row,
    );
    this.updateTurn(turnIndex, { changes });
  }

  isFile(change: AiAssistChange): boolean {
    return change.op === 'file.add' || this.isEdit(change);
  }

  /** A file replaced, whether the directory's or a workspace's own: shown as what changes. */
  isEdit(change: AiAssistChange): boolean {
    return change.op === 'file.edit' || change.op === 'workspace.file.edit';
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
    // an added file is read whole; a changed one is read again, keeping edits the planner made meanwhile
    for (const result of applied.filter(
      (r) =>
        (r.op === 'file.add' ||
          r.op === 'file.edit' ||
          r.op === 'workspace.file.edit') &&
        r.fileId,
    )) {
      this.fileService.refreshFile(result.fileId).pipe(take(1)).subscribe();
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
}
