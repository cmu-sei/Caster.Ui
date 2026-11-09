// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetConnection,
  EnvironmentSetEntry,
  EnvironmentSetEntryChange,
  EnvironmentSetEntryChangeOperation,
  EnvironmentSetValueSource,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import {
  apiErrorMessage,
  effectiveName,
} from 'src/app/environment-sets/environment-set-rules';
import { variableLabel } from 'src/app/environment-sets/environment-set-snippets';
import {
  EnvironmentSetEntryDialogComponent,
  EnvironmentSetEntryDialogData,
  EnvironmentSetEntryFields,
} from '../environment-set-entry-dialog/environment-set-entry-dialog.component';

export interface EnvironmentSetMultiEditDialogData {
  sets: EnvironmentSet[];
  secrets: EnvironmentSecrets | null;
  connections: EnvironmentSetConnection[];
  canUseConnections: boolean;
}

/** One entry name across the selected sets. */
export interface MultiEditRow {
  name: string;
  /** The entry as one of the sets has it, for its kind and name. */
  entry: EnvironmentSetEntry;
  /** The selected sets that have it, by id. */
  setIds: string[];
  /** Whether the sets that have it give it different values or sources. */
  mixed: boolean;
}

/**
 * Edits the selected sets together: one row per entry name, showing which sets have it and
 * whether their values match. Changes are collected, then saved in one request, which the API
 * checks against the whole final state.
 */
@Component({
  selector: 'cas-environment-set-multi-edit-dialog',
  templateUrl: './environment-set-multi-edit-dialog.component.html',
  styleUrls: ['./environment-set-multi-edit-dialog.component.scss'],
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatIcon,
    MatTooltip,
  ],
})
export class EnvironmentSetMultiEditDialogComponent {
  readonly data = inject<EnvironmentSetMultiEditDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject(
    MatDialogRef<EnvironmentSetMultiEditDialogComponent>,
  );
  private dialog = inject(MatDialog);
  private environmentSetService = inject(EnvironmentSetService);

  readonly Operation = EnvironmentSetEntryChangeOperation;
  readonly variableLabel = variableLabel;
  readonly title = `Edit ${this.data.sets.length} Environment Sets`;

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** The pending changes, by effective name. */
  readonly changes = signal<Record<string, EnvironmentSetEntryChange>>({});

  readonly rows = computed<MultiEditRow[]>(() => {
    const rows = new Map<string, MultiEditRow & { signatures: Set<string> }>();

    for (const set of this.data.sets) {
      for (const entry of set.entries ?? []) {
        const name = effectiveName(entry.kind, entry.targetName);
        const row = rows.get(name) ?? {
          name,
          entry,
          setIds: [],
          mixed: false,
          signatures: new Set<string>(),
        };
        row.setIds.push(set.id);
        row.signatures.add(signature(entry));
        rows.set(name, row);
      }
    }

    return [...rows.values()]
      .map(({ signatures, ...row }) => ({ ...row, mixed: signatures.size > 1 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** Changes to entries no selected set has yet: rows of their own. */
  readonly newEntries = computed(() =>
    Object.entries(this.changes())
      .filter(([name]) => !this.rows().some((x) => x.name === name))
      .map(([, change]) => change),
  );

  readonly changeCount = computed(() => Object.keys(this.changes()).length);

  setName(id: string): string {
    return this.data.sets.find((x) => x.id === id)?.name ?? id;
  }

  setNames(row: MultiEditRow): string {
    return row.setIds.map((x) => this.setName(x)).join(', ');
  }

  change(row: MultiEditRow): EnvironmentSetEntryChange | null {
    return this.changes()[row.name] ?? null;
  }

  /** Whether the sets that lack the row's entry would get it. */
  addsToOthers(row: MultiEditRow): boolean {
    return (
      this.change(row)?.operation === EnvironmentSetEntryChangeOperation.Upsert
    );
  }

  edit(row: MultiEditRow): void {
    this.openEntry(`Edit ${variableLabel(row.entry)}`, row.entry).subscribe(
      (fields) => {
        if (fields) {
          this.put(row.name, {
            ...fields,
            operation:
              row.setIds.length === this.data.sets.length ||
              this.addsToOthers(row)
                ? EnvironmentSetEntryChangeOperation.Upsert
                : EnvironmentSetEntryChangeOperation.Update,
          });
        }
      },
    );
  }

  /** Adds an edited row's entry to the sets that lack it, or stops doing so. */
  toggleAddToOthers(row: MultiEditRow, add: boolean): void {
    const change = this.change(row);

    if (
      change &&
      change.operation !== EnvironmentSetEntryChangeOperation.Delete
    ) {
      this.put(row.name, {
        ...change,
        operation: add
          ? EnvironmentSetEntryChangeOperation.Upsert
          : EnvironmentSetEntryChangeOperation.Update,
      });
    }
  }

  remove(row: MultiEditRow): void {
    this.put(row.name, {
      operation: EnvironmentSetEntryChangeOperation.Delete,
      kind: row.entry.kind,
      targetName: row.entry.targetName,
      valueSource: EnvironmentSetValueSource.Plain,
    });
  }

  undo(name: string): void {
    this.changes.update((x) => {
      const { [name]: _, ...rest } = x;
      return rest;
    });
  }

  addEntry(): void {
    this.openEntry('Add Entry to Every Selected Set').subscribe((fields) => {
      if (fields) {
        this.put(effectiveName(fields.kind, fields.targetName), {
          ...fields,
          operation: EnvironmentSetEntryChangeOperation.Upsert,
        });
      }
    });
  }

  describe(change: EnvironmentSetEntryChange): string {
    switch (change.valueSource) {
      case EnvironmentSetValueSource.Secret:
        return `Secret from ${change.secretName}`;
      case EnvironmentSetValueSource.Connection:
        return `${change.connectionField} of connection ${change.connectionName}`;
      default:
        return change.value ?? '';
    }
  }

  save(): void {
    if (this.saving() || this.changeCount() === 0) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.environmentSetService
      .batchEdit({
        environmentSetIds: this.data.sets.map((x) => x.id),
        changes: Object.values(this.changes()),
      })
      .subscribe({
        next: (sets) => this.dialogRef.close(sets),
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(err));
        },
      });
  }

  private put(name: string, change: EnvironmentSetEntryChange): void {
    this.changes.update((x) => ({ ...x, [name]: change }));
  }

  private openEntry(title: string, entry?: EnvironmentSetEntry) {
    return this.dialog
      .open<
        EnvironmentSetEntryDialogComponent,
        EnvironmentSetEntryDialogData,
        EnvironmentSetEntryFields
      >(EnvironmentSetEntryDialogComponent, {
        data: {
          set: this.data.sets[0],
          entry,
          secrets: this.data.secrets,
          connections: this.data.connections,
          canUseConnections: this.data.canUseConnections,
          returnFields: { title },
        },
        width: '560px',
        maxWidth: '90vw',
        disableClose: true,
      })
      .afterClosed();
  }
}

/** What an entry gives, for telling whether two sets agree. */
function signature(entry: EnvironmentSetEntry): string {
  return JSON.stringify([
    entry.valueSource,
    entry.value ?? null,
    entry.secretName ?? null,
    entry.connectionName?.toLowerCase() ?? null,
    entry.connectionField ?? null,
  ]);
}
