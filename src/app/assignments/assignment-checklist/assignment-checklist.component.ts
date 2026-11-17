// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MatFormField,
  MatLabel,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { NgTemplateOutlet } from '@angular/common';
import { AssignmentItem, assignmentDiff } from '../assignment.model';

/**
 * A searchable list of things to assign, each with a checkbox: checked is assigned. Marks what
 * changed since it opened, so a save shows what it will do. Read-only, it lists what is assigned.
 */
@Component({
  selector: 'cas-assignment-checklist',
  templateUrl: './assignment-checklist.component.html',
  styleUrls: ['./assignment-checklist.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatIcon,
    MatIconButton,
    MatSlideToggle,
    NgTemplateOutlet,
  ],
})
export class AssignmentChecklistComponent {
  readonly items = input<AssignmentItem[]>([]);
  /** What was assigned when the list opened, to mark changes against. */
  readonly initial = input<string[]>([]);
  readonly selected = model<string[]>([]);
  readonly editable = input(true);
  readonly searchLabel = input('Search');
  readonly emptyText = input('Nothing to assign.');

  readonly filter = signal('');
  readonly assignedOnly = signal(false);

  private readonly selectedIds = computed(() => new Set(this.selected()));

  /** Assigned first, as they were when the list opened, then by name; filtered. */
  readonly visible = computed(() => {
    const initial = new Set(this.initial());
    const selected = this.selectedIds();
    const term = this.filter().trim().toLowerCase();
    return this.items()
      .filter((x) => this.editable() || selected.has(x.id) || x.locked)
      .filter(
        (x) => !this.assignedOnly() || selected.has(x.id) || x.locked === true,
      )
      .filter(
        (x) =>
          !term ||
          x.name.toLowerCase().includes(term) ||
          (x.detail ?? '').toLowerCase().includes(term),
      )
      .sort(
        (a, b) =>
          Number(!(initial.has(a.id) || a.locked)) -
            Number(!(initial.has(b.id) || b.locked)) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
  });

  readonly changes = computed(() =>
    assignmentDiff(this.initial(), this.selected()),
  );

  isSelected(item: AssignmentItem): boolean {
    return item.locked === true || this.selectedIds().has(item.id);
  }

  change(item: AssignmentItem): 'Adding' | 'Removing' | null {
    const { add, remove } = this.changes();
    return add.includes(item.id)
      ? 'Adding'
      : remove.includes(item.id)
        ? 'Removing'
        : null;
  }

  toggle(item: AssignmentItem, checked: boolean): void {
    const rest = this.selected().filter((x) => x !== item.id);
    this.selected.set(checked ? [...rest, item.id] : rest);
  }
}
