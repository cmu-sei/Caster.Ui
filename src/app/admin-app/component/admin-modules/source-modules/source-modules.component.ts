// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatNoDataRow,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource,
} from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Module, ModuleSource } from 'src/app/generated/caster-api';
import {
  MODULE_PAGE_SIZES,
  ModuleRow,
  formatSyncTime,
  isGitlabSource,
  missingSinceOf,
  moduleMatches,
  reportsSourcePresence,
  sortModules,
} from '../module-source-groups';

/**
 * The Modules of one source, or of the leftover group, as a table that opens
 * under the source's row: its own Search, sort and paginator, and a Delete
 * for each leftover or GitLab Module. A git Module is not read apart from its
 * source, so it has no Refresh of its own: refresh the source.
 */
@Component({
  selector: 'cas-source-modules',
  templateUrl: './source-modules.component.html',
  styleUrls: ['./source-modules.component.scss'],
  imports: [
    FormsModule,
    MatIcon,
    MatIconButton,
    MatFormField,
    MatInput,
    MatSuffix,
    MatPaginator,
    MatTooltip,
    MatTable,
    MatSort,
    MatSortHeader,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatNoDataRow,
  ],
})
export class SourceModulesComponent {
  private confirmService = inject(CrucibleDialogService);

  /** The source, or null for the group of Modules not in a configured source. */
  readonly source = input<ModuleSource | null>(null);
  /** The Modules to list: all of the source's, or the ones the page's search kept. */
  readonly modules = input<ModuleRow[]>([]);
  /** How many Modules the source has, whatever the page's search. */
  readonly total = input<number>(0);
  /** Every configured source, to tell whether a Module's source is GitLab. */
  readonly sources = input<ModuleSource[]>([]);
  readonly canEdit = input<boolean>(false);

  readonly remove = output<string>();

  /** The columns, without the actions one when no Module here has an action. */
  readonly displayedColumns = computed(() => {
    const columns = ['name', 'path', 'latestVersion', 'description'];
    return this.modules().some((row) => this.canDelete(row))
      ? ['actions', ...columns]
      : columns;
  });
  readonly pageSizes = MODULE_PAGE_SIZES;

  readonly dataSource = new MatTableDataSource<ModuleRow>([]);
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  /** What this source's Search box holds, on top of the page's search. */
  filterString = '';

  readonly isGitlab = computed(() => {
    const source = this.source();
    return !!source && isGitlabSource(source);
  });

  constructor() {
    this.dataSource.filterPredicate = (row, filter) =>
      moduleMatches(row, filter);
    this.dataSource.sortData = (data, sort) =>
      sortModules(data, sort.active, sort.direction);
    effect(() => {
      this.dataSource.data = this.modules();
    });
    effect(() => {
      this.dataSource.paginator = this.paginator();
      this.dataSource.sort = this.sort();
    });
  }

  applyFilter(value: string) {
    // Lowercase only the filter: filterString is bound to the Search box.
    this.dataSource.filter = value.trim().toLowerCase();
  }

  clearFilter() {
    this.filterString = '';
    this.applyFilter('');
  }

  trackById(_index: number, row: ModuleRow): string {
    return row.id;
  }

  /** What an open source with no Modules says instead of an empty table. */
  emptyText(): string {
    if (this.isGitlab()) {
      return 'No GitLab projects have been added yet. Use Add a GitLab Project to add one by its ID.';
    }
    return (
      'Caster found no Modules in this source. A Module is a folder of its repository ' +
      'with a variables.tf.json and a version tag, such as v1.0.0. Add one, then Refresh the source.'
    );
  }

  private sourceOf(row: ModuleRow): ModuleSource | undefined {
    return this.sources().find((s) => s.name === row.source);
  }

  /** Why Delete is not available, or null when it is. */
  deleteDisabledReason(): string | null {
    return this.canEdit()
      ? null
      : 'Deleting a Module needs the ManageModules permission';
  }

  /** When the Module stopped being found in its source, for the viewer, or null while it is still there. */
  missingSince(row: ModuleRow): string | null {
    const since = missingSinceOf(row);
    return since ? formatSyncTime(since) : null;
  }

  /** The tooltip for a leftover's badge. */
  leftoverReason(row: ModuleRow): string {
    const since = this.missingSince(row);
    const where = row.source
      ? `Not found in ${row.source}`
      : 'Its source is not configured';
    return since
      ? `${where} since ${since}. Delete it once nothing uses it.`
      : `${where}. Delete it once nothing uses it.`;
  }

  /** The description cut at 80 characters; the whole text is in the cell's tooltip. */
  shortDescription(row: Module): string {
    const text = row.description ?? '';
    return text.length > 80 ? text.slice(0, 80) + ' ...' : text;
  }

  /**
   * Delete is for leftovers: a Module no longer in its source, or a GitLab
   * Module, which is added by hand. A Module still in its source would come
   * back on the next read, so it has no Delete. A Module no configured source owns is
   * a leftover whatever the API says, since its source is never read again. An API that does not say whether
   * a Module is still in its source (missingSince, inSource) leaves a git Module
   * without Delete, since it cannot be told from a leftover: see presenceUnknown.
   */
  canDelete(row: ModuleRow): boolean {
    const source = this.sourceOf(row);
    if (source && isGitlabSource(source)) {
      return true;
    }
    // No configured source owns it: its source was removed, so it is never read again.
    return !row.source || (reportsSourcePresence(row) && row.leftover);
  }

  /** True when some git Module here is without Delete only because the API does not say if it is a leftover. */
  readonly presenceUnknown = computed(() =>
    this.modules().some(
      (row) => !reportsSourcePresence(row) && !this.canDelete(row),
    ),
  );

  /** Why Delete is not offered on those Modules. */
  readonly presenceUnknownReason =
    "This Caster API doesn't say which Modules are no longer in their source, so Delete isn't offered. Update the Caster API to see and delete leftovers.";

  deleteModule(module: Module) {
    this.confirmService
      .confirm({
        title: 'Delete Module',
        message: `Are you sure that you want to delete ${module.name}?`,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.remove.emit(module.id);
        }
      });
  }
}
