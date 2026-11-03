// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  MatFormField,
  MatLabel,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { NgTemplateOutlet } from '@angular/common';
import {
  EnvironmentSetEntryKind,
  EnvironmentSetValueSource,
  ProjectEnvironmentSet,
  ProjectEnvironmentSetEntry,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from '../environment-set.service';
import { apiErrorMessage } from '../environment-set-rules';
import {
  declarationSnippet,
  deliveredAs,
  entryCopyText,
  kindLabel,
  setSnippet,
  variableLabel,
} from '../environment-set-snippets';

/** Sets up to this many start expanded; beyond it only incomplete sets do. */
const EXPAND_ALL_UP_TO = 3;

/**
 * A project's Environment Sets as its members see them, one panel per set: what each
 * variable is called in Terraform, its plain value or whether its secret is available,
 * and the declaration to copy or insert. Never secret sources or values. Used by the
 * project dialog and, compact, by the editor sidebar.
 */
@Component({
  selector: 'cas-project-environment-sets-view',
  templateUrl: './project-environment-sets-view.component.html',
  styleUrls: ['./project-environment-sets-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatExpansionModule,
    MatFormField,
    MatLabel,
    MatSuffix,
    MatInput,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    NgTemplateOutlet,
  ],
})
export class ProjectEnvironmentSetsViewComponent implements OnInit {
  private environmentSetService = inject(EnvironmentSetService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);

  readonly projectId = input.required<string>();
  /** Two-line entries instead of a table, for the narrow editor sidebar. */
  readonly compact = input(false);
  /** Offer Insert (the editor sidebar, while the file is being edited). */
  readonly canInsert = input(false);
  readonly insert = output<string>();

  readonly Source = EnvironmentSetValueSource;
  readonly variableLabel = variableLabel;
  readonly deliveredAs = deliveredAs;
  readonly kindLabel = kindLabel;

  readonly sets = signal<ProjectEnvironmentSet[] | null>(null);
  readonly error = signal<string | null>(null);
  readonly filter = signal('');
  readonly showHelp = signal(false);
  private readonly expanded = signal<Record<string, boolean>>({});

  /** The sets and entries matching the filter; a set whose name matches keeps every entry. */
  readonly visibleSets = computed(() => {
    const sets = this.sets() ?? [];
    const filter = this.filter().trim().toLowerCase();

    if (!filter) {
      return sets;
    }

    return sets
      .map((set) => {
        if ((set.name ?? '').toLowerCase().includes(filter)) {
          return set;
        }

        const entries = (set.entries ?? []).filter((entry) =>
          [entry.targetName, variableLabel(entry), entry.value]
            .filter((x) => !!x)
            .some((x) => x.toLowerCase().includes(filter)),
        );

        return entries.length ? { ...set, entries } : null;
      })
      .filter((x) => !!x);
  });

  ngOnInit(): void {
    this.environmentSetService
      .projectSets$(this.projectId())
      .subscribe((sets) => this.setsChanged(sets));

    this.environmentSetService.loadProjectSets(this.projectId()).subscribe({
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  isExpanded(set: ProjectEnvironmentSet): boolean {
    return !!this.filter().trim() || !!this.expanded()[set.environmentSetId];
  }

  setExpanded(set: ProjectEnvironmentSet, expanded: boolean): void {
    this.expanded.update((x) => ({ ...x, [set.environmentSetId]: expanded }));
  }

  missingCount(set: ProjectEnvironmentSet): number {
    return (set.entries ?? []).filter((x) => !x.isAvailable).length;
  }

  hasDeclarations(set: ProjectEnvironmentSet): boolean {
    return (set.entries ?? []).some(
      (x) => x.kind === EnvironmentSetEntryKind.TerraformVariable,
    );
  }

  needsDeclaration(entry: ProjectEnvironmentSetEntry): boolean {
    return entry.kind === EnvironmentSetEntryKind.TerraformVariable;
  }

  copyTooltip(entry: ProjectEnvironmentSetEntry): string {
    return this.needsDeclaration(entry)
      ? `Copy the declaration of var.${entry.targetName}`
      : `Copy ${entry.targetName}. No code needed: the provider reads it from the environment`;
  }

  copyEntry(entry: ProjectEnvironmentSetEntry): void {
    this.copy(
      entryCopyText(entry),
      this.needsDeclaration(entry) ? 'Declaration copied' : 'Name copied',
    );
  }

  copySet(set: ProjectEnvironmentSet): void {
    this.copy(setSnippet(this.fullSet(set)), `${set.name} copied`);
  }

  insertEntry(entry: ProjectEnvironmentSetEntry): void {
    const snippet = declarationSnippet(entry);

    if (snippet) {
      this.insert.emit(snippet);
    }
  }

  insertSet(set: ProjectEnvironmentSet): void {
    this.insert.emit(setSnippet(this.fullSet(set)));
  }

  private copy(text: string, message: string): void {
    const copied = this.clipboard.copy(text);
    this.snackBar.open(copied ? message : 'Could not copy', undefined, {
      duration: 2000,
    });
  }

  /** The set as loaded, not as filtered: Copy set copies all of it. */
  private fullSet(set: ProjectEnvironmentSet): ProjectEnvironmentSet {
    return (
      (this.sets() ?? []).find(
        (x) => x.environmentSetId === set.environmentSetId,
      ) ?? set
    );
  }

  private setsChanged(sets: ProjectEnvironmentSet[] | null): void {
    if (sets === null) {
      return;
    }

    // A set seen for the first time starts expanded if there are only a few, or if it is
    // incomplete; after that the user's choice stands.
    const known = this.expanded();
    const next = { ...known };

    for (const set of sets) {
      if (!(set.environmentSetId in known)) {
        next[set.environmentSetId] =
          sets.length <= EXPAND_ALL_UP_TO || !set.isComplete;
      } else if (!set.isComplete) {
        next[set.environmentSetId] = true;
      }
    }

    this.expanded.set(next);
    this.sets.set(sets);
  }
}
