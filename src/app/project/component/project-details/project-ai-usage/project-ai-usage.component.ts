// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  MatAccordion,
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/list';
import { take } from 'rxjs/operators';
import { ProjectAiUsage, ProjectsService } from 'src/app/generated/caster-api';

/**
 * What drafting with AI used in this project: every call to an AI model made
 * for one of its directories, by task, with an estimate of the cost from the
 * prices the server is configured with. Shows nothing for a project drafted
 * without AI, or for a user who may not read it.
 */
@Component({
  selector: 'cas-project-ai-usage',
  templateUrl: './project-ai-usage.component.html',
  styleUrls: ['./project-ai-usage.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatIcon,
    MatDivider,
    DecimalPipe,
  ],
})
export class ProjectAiUsageComponent {
  private projectsService = inject(ProjectsService);

  readonly projectId = input<string>(undefined);
  readonly usage = signal<ProjectAiUsage | undefined>(undefined);

  private static readonly labels: Record<string, string> = {
    design: 'Draft Design with AI',
    terraform: 'Draft or edit Terraform with AI',
    brief: 'Terraform from a scenario brief',
  };

  constructor() {
    // the project page keeps this panel when it switches project
    effect(() => {
      const projectId = this.projectId();
      this.usage.set(undefined);
      if (projectId) {
        this.load(projectId);
      }
    });
  }

  /** Each opening reads again, so a draft made since shows. */
  onExpanded() {
    const projectId = this.projectId();
    if (projectId) {
      this.load(projectId);
    }
  }

  private load(projectId: string) {
    this.projectsService
      .getProjectAiUsage(projectId)
      .pipe(take(1))
      .subscribe({
        next: (usage) => {
          // an answer for a project the page has since left is dropped
          if (projectId === this.projectId()) {
            this.usage.set(usage?.calls ? usage : undefined);
          }
        },
        // usage is extra information; without it the page is the same
        error: () => this.usage.set(undefined),
      });
  }

  label(task: string): string {
    return ProjectAiUsageComponent.labels[task] ?? task;
  }

  hasCost(micros: number | null | undefined): boolean {
    return micros !== null && micros !== undefined;
  }

  // the server counts in millionths of a dollar; a planner reads dollars and cents
  dollars(micros: number | null | undefined): string {
    if (!this.hasCost(micros)) {
      return '';
    }
    return micros < 10_000
      ? 'under $0.01'
      : `$${(micros / 1_000_000).toFixed(2)}`;
  }
}
