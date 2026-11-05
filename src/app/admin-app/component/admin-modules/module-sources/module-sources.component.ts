// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, computed, inject, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ModuleSource } from 'src/app/generated/caster-api';
import { GitlabProjectDialogComponent } from '../gitlab-project-dialog/gitlab-project-dialog.component';
import {
  formatSyncTime,
  isGitlabSource,
} from '../modules-list/module-list.component';

/** What a source's row says about its last read. */
export interface SourceStatus {
  kind: 'ok' | 'empty' | 'warning' | 'failed' | 'pending';
  icon: string;
  text: string;
}

/**
 * The module sources the Modules come from, with how each one's last read
 * went. Sources are configured in Caster's settings, so this is where an
 * administrator sees them and refreshes one; it is also where a failing
 * source says why.
 */
@Component({
  selector: 'cas-module-sources',
  templateUrl: './module-sources.component.html',
  styleUrls: ['./module-sources.component.css'],
  imports: [
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIcon,
    MatIconButton,
    MatTooltip,
  ],
})
export class ModuleSourcesComponent {
  private dialog = inject(MatDialog);

  readonly sources = input<ModuleSource[]>([]);
  /** False when the API could not list its sources at all. */
  readonly listed = input<boolean>(true);
  readonly canEdit = input<boolean>(false);
  readonly isLoading = input<boolean>(false);

  /** Re-read every source. */
  readonly refreshAll = output<void>();
  /** Re-read one git source by its name, or add one GitLab project by its ID. */
  readonly refresh = output<string>();

  /** Sources that need someone to act: failed, or Modules with no tags. */
  readonly failing = computed(
    () =>
      (this.sources() ?? []).filter((s) =>
        ['failed', 'warning'].includes(this.status(s).kind),
      ).length,
  );

  readonly about =
    "Modules come from module sources: git repositories listed in Caster's settings. " +
    'Caster reads every source when this page opens and lists each Module it finds. ' +
    "To add a Module, add it to a source's repository with a variables.tf.json and a version tag, " +
    'such as v1.0.0, then Refresh that source.';

  isGitlab(source: ModuleSource): boolean {
    return isGitlabSource(source);
  }

  status(source: ModuleSource): SourceStatus {
    // The API's state, when it reports one; older APIs only set error.
    const { state, message } = source as ModuleSource & {
      state?: 'Ok' | 'Empty' | 'Warning' | 'Error';
      message?: string | null;
    };
    if (state === 'Empty') {
      return {
        kind: 'empty',
        icon: 'mdi-folder-outline',
        text: message || 'No Modules yet.',
      };
    }
    if (state === 'Warning') {
      return {
        kind: 'warning',
        icon: 'mdi-alert-outline',
        text: message || 'Needs attention.',
      };
    }
    if (source.error) {
      return {
        kind: 'failed',
        icon: 'mdi-alert-circle-outline',
        text: source.lastSuccess
          ? `${source.error} Showing its Modules from ${formatSyncTime(source.lastSuccess)}.`
          : source.error,
      };
    }
    return source.lastSuccess
      ? {
          kind: 'ok',
          icon: 'mdi-check-circle-outline',
          text: `Updated ${formatSyncTime(source.lastSuccess)}`,
        }
      : { kind: 'pending', icon: 'mdi-clock-outline', text: 'Not read yet' };
  }

  /** The source's clone URL, when the API reports it (credentials already removed). */
  repositoryUrl(source: ModuleSource): string | null {
    return (source as ModuleSource & { url?: string | null }).url || null;
  }

  /**
   * Where a browser can open the repository: an https clone URL without its
   * ".git". Null for ssh and file URLs, whose web address can't be told
   * reliably from the clone URL.
   */
  repositoryLink(source: ModuleSource): string | null {
    const url = this.repositoryUrl(source);
    if (!url || !/^https?:\/\//i.test(url)) {
      return null;
    }
    return url.replace(/\.git\/?$/i, '');
  }

  /** A GitLab source adds one project at a time, by its ID. */
  addGitlabProject() {
    this.dialog
      .open<GitlabProjectDialogComponent, unknown, string>(
        GitlabProjectDialogComponent,
        { width: '400px' },
      )
      .afterClosed()
      .subscribe((projectId) => {
        if (projectId) {
          this.refresh.emit(projectId);
        }
      });
  }
}
