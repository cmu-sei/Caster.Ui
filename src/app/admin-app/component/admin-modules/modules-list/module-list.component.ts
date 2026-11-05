// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
} from '@angular/material/table';
import { Module, ModuleSource } from '../../../../generated/caster-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatDivider } from '@angular/material/divider';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { ClipboardModule } from 'ngx-clipboard';
import { NgClass, DatePipe } from '@angular/common';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { AddModuleDialogComponent } from '../add-module-dialog/add-module-dialog.component';
import { GitlabProjectDialogComponent } from '../gitlab-project-dialog/gitlab-project-dialog.component';

/** The provider name of the legacy GitLab source. */
export const GITLAB_PROVIDER = 'gitlab';

/**
 * A Module as the table shows it: with the name of the source it came from
 * and the name of its highest version.
 */
export interface ModuleRow extends Module {
  source: string;
  latestVersion: string;
}

/** When an API instance last synced a source, in the viewer's time zone. */
export function formatSyncTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function isGitlabSource(source: ModuleSource): boolean {
  return source.provider?.toLowerCase() === GITLAB_PROVIDER;
}

/**
 * The configured source a Module came from. A git source's Modules have Paths
 * of <sourceName> or <sourceName>/<subdirectory>; the legacy GitLab source's
 * use the project's own path, so any other Module is the GitLab source's when
 * one is configured. Null when no configured source provides the Module.
 */
export function moduleSourceOf(
  module: Module,
  sources: ModuleSource[],
): ModuleSource | null {
  const path = (module.path ?? '').toLowerCase();
  const named = sources
    .filter((s) => !isGitlabSource(s) && s.name)
    .filter((s) => {
      const name = s.name.toLowerCase();
      return path === name || path.startsWith(name + '/');
    })
    .sort((a, b) => b.name.length - a.name.length)[0];

  return named ?? sources.find(isGitlabSource) ?? null;
}

@Component({
  selector: 'cas-admin-module-list',
  templateUrl: './module-list.component.html',
  styleUrls: ['./module-list.component.css'],
  imports: [
    MatIcon,
    MatFormField,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatPaginator,
    MatTooltip,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatDivider,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatSortHeader,
    MatCellDef,
    MatCell,
    ClipboardModule,
    NgClass,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatCard,
    MatProgressSpinner,
    DatePipe,
  ],
})
export class AdminModuleListComponent implements OnInit, OnChanges {
  private confirmService = inject(CrucibleDialogService);
  private dialog = inject(MatDialog);

  public displayedColumns: string[] = [
    'actions',
    'name',
    'description',
    'source',
    'path',
    'versionsCount',
    'latestVersion',
    'dateModified',
  ];
  public filterString = '';
  public dataSource = new MatTableDataSource<ModuleRow>([]);

  readonly modules = input<Module[]>(undefined);
  readonly sources = input<ModuleSource[]>([]);
  readonly isLoading = input<boolean>(undefined);
  readonly canEdit = input<boolean>(undefined);
  /** Sync every configured source, re-reading every version. */
  readonly syncAll = output<void>();
  /** Sync one source by name, one Module by Path, or one GitLab project by ID. */
  readonly sync = output<string>();
  readonly delete = output<string>();
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.filterPredicate = (row, filter) =>
      [row.name, row.description, row.source, row.path, row.latestVersion]
        .filter((value) => !!value)
        .some((value) => value.toLowerCase().includes(filter));
  }

  ngOnInit() {
    const paginator = this.paginator();
    if (paginator) {
      this.dataSource.paginator = paginator;
    }
    this.dataSource.sort = this.sort();
    this.dataSource.filter = this.filterString;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.modules || changes.sources) {
      const sources = this.sources() ?? [];
      this.dataSource.data = (this.modules() ?? []).map((module) => ({
        ...module,
        source: moduleSourceOf(module, sources)?.name ?? '',
        // The API lists a Module's versions highest first.
        latestVersion: module.versions?.[0]?.name ?? '',
      }));
    }
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue.trim().toLowerCase();
    this.dataSource.filter = this.filterString;
  }

  clearFilter() {
    this.applyFilter('');
  }

  isGitlab(source: ModuleSource): boolean {
    return isGitlabSource(source);
  }

  /** The icon for how a source's last sync went. */
  statusIcon(source: ModuleSource): string {
    if (source.error) {
      return 'mdi-alert-circle-outline';
    }
    return source.lastSuccess
      ? 'mdi-check-circle-outline'
      : 'mdi-clock-outline';
  }

  /** How a source's last sync went, in words, for its sync menu entry. */
  statusText(source: ModuleSource): string {
    if (source.error) {
      return source.lastAttempt
        ? `Failed ${formatSyncTime(source.lastAttempt)}`
        : 'Failed';
    }
    return source.lastSuccess
      ? `Synced ${formatSyncTime(source.lastSuccess)}`
      : 'Not synced yet';
  }

  /**
   * Adds or updates Modules from an External Module ID, as the box above the
   * list used to: a source name, name/subdirectory for one Module, or a GitLab
   * project ID.
   */
  addModule() {
    this.dialog
      .open<AddModuleDialogComponent, unknown, string>(
        AddModuleDialogComponent,
        { width: '480px' },
      )
      .afterClosed()
      .subscribe((externalModuleId) => {
        if (externalModuleId) {
          this.sync.emit(externalModuleId);
        }
      });
  }

  /**
   * A git source is synced by its name. The GitLab source is synced one
   * project at a time, so ask for the project's ID.
   */
  syncSource(source: ModuleSource) {
    if (!this.isGitlab(source)) {
      this.sync.emit(source.name);
      return;
    }

    this.dialog
      .open<GitlabProjectDialogComponent, unknown, string>(
        GitlabProjectDialogComponent,
        { width: '400px' },
      )
      .afterClosed()
      .subscribe((projectId) => {
        if (projectId) {
          this.sync.emit(projectId);
        }
      });
  }

  /**
   * A git Module is synced by its Path. A GitLab Module would need its project
   * ID, which Caster does not store, so it has no per-row sync.
   */
  canSyncModule(row: ModuleRow): boolean {
    const source = this.sources()?.find((s) => s.name === row.source);
    return !!source && !this.isGitlab(source) && !!row.path;
  }

  syncModule(row: ModuleRow) {
    this.sync.emit(row.path);
  }

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
          this.delete.emit(module.id);
        }
      });
  }
}
