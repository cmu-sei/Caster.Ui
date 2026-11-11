// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import {
  CapacityCheck,
  CapacityCheckStatus,
  CapacityService,
  EffectiveLimit,
  LimitSource,
} from '../../../generated/caster-api';

/** One row of the limits table: a limit, what the workspace has after the run, and what is in force. */
export interface CapacityLimitRow {
  label: string;
  after: number;
  unit: string;
  limit: EffectiveLimit | null;
  over: boolean;
}

/**
 * The size check of a planned run, shown next to its output before Apply:
 * what the run adds, the workspace's totals against its limits, and the room
 * on each host and datastore. A run over a limit, or out of room with the room
 * check set to Block, is refused; one out of room with it set to Warn can be
 * applied once the warning is acknowledged here.
 */
@Component({
  selector: 'cas-run-capacity',
  templateUrl: './run-capacity.component.html',
  styleUrls: ['./run-capacity.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCheckbox, MatIcon, DecimalPipe],
})
export class RunCapacityComponent {
  private capacityService = inject(CapacityService);
  private destroyRef = inject(DestroyRef);

  readonly runId = input.required<string>();
  readonly canEdit = input<boolean>(false);

  /** Whether the room warning is acknowledged, which Apply sends along. */
  readonly acknowledged = model<boolean>(false);

  /** The check, each time it is read. */
  readonly checked = output<CapacityCheck>();

  readonly check = signal<CapacityCheck | null>(null);
  readonly failed = signal(false);

  readonly status = computed(() => this.check()?.status);
  readonly statuses = CapacityCheckStatus;

  readonly limitRows = computed<CapacityLimitRow[]>(() => {
    const check = this.check();
    if (!check) {
      return [];
    }
    const over = new Set((check.limitViolations ?? []).map((x) => x.limit));
    const limits = check.limits ?? {};
    const after = check.after ?? {};
    return [
      {
        label: 'Machines',
        after: after.machines ?? 0,
        unit: '',
        limit: limits.maxMachines ?? null,
        over: over.has('MaxMachines'),
      },
      {
        label: 'vCPU',
        after: after.vcpu ?? 0,
        unit: '',
        limit: limits.maxVcpu ?? null,
        over: over.has('MaxVcpu'),
      },
      {
        label: 'Memory',
        after: (after.memoryMiB ?? 0) / 1024,
        unit: 'GiB',
        limit: limits.maxMemoryGiB ?? null,
        over: over.has('MaxMemoryGiB'),
      },
      {
        label: 'Disk',
        after: after.diskGiB ?? 0,
        unit: 'GiB',
        limit: limits.maxDiskGiB ?? null,
        over: over.has('MaxDiskGiB'),
      },
    ];
  });

  private subscription?: Subscription;

  constructor() {
    effect(() => this.load(this.runId()));
  }

  load(runId: string) {
    this.subscription?.unsubscribe();
    this.failed.set(false);
    this.subscription = this.capacityService
      .getRunCapacity(runId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (check) => {
          this.check.set(check);
          this.checked.emit(check);
        },
        error: () => this.failed.set(true),
      });
  }

  source(limit: EffectiveLimit | null): string {
    switch (limit?.source) {
      case LimitSource.Workspace:
        return 'workspace';
      case LimitSource.Project:
        return 'project';
      case LimitSource.Global:
        return 'global';
      default:
        return '';
    }
  }

  gib(mib: number | undefined): number {
    return (mib ?? 0) / 1024;
  }
}
