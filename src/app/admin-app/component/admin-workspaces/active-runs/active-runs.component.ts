// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
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
import { Run, RunStatus } from 'src/app/generated/caster-api';
import { RunComponent } from '../../../../workspace/components/run/run.component';

/** The Workspace a run belongs to, as far as the viewer may read it. */
export interface RunWorkspace {
  name: string;
  /** Null when the viewer can't read the Workspace's directory or Project. */
  projectId: string | null;
  projectName: string | null;
}

/** One active run as the table shows it. */
export interface RunRow {
  run: Run;
  /** Undefined while it is being looked up; null if the viewer can't read it. */
  workspace: RunWorkspace | null | undefined;
  workspaceName: string;
  projectName: string;
  type: string;
  status: string;
  statusTooltip: string;
  startedBy: string;
  createdAt: string;
}

const STATUS_LABELS: Partial<Record<RunStatus, [string, string]>> = {
  [RunStatus.Queued]: ['Queued', 'Waiting for its turn to plan'],
  [RunStatus.Planning]: ['Planning', 'Terraform is working out what to change'],
  [RunStatus.ApplyQueued]: [
    'Apply Queued',
    'The plan was approved and is waiting for its turn to apply',
  ],
  [RunStatus.Applying]: ['Applying', 'Terraform is making the planned changes'],
};

/** When a run started, in the viewer's time zone. */
export function formatStarted(value: string): string {
  return value
    ? new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : '';
}

export function toRunRow(
  run: Run,
  workspace: RunWorkspace | null | undefined,
): RunRow {
  const [label, tooltip] = STATUS_LABELS[run.status] ?? [run.status, ''];
  // The queue says where a waiting run is in line.
  const position = /Position (\d+)/.exec(run.displayStatus ?? '')?.[1];
  return {
    run,
    workspace,
    workspaceName:
      workspace?.name ??
      (workspace === null ? 'Workspace you can\'t view' : 'Loading...'),
    projectName: workspace?.projectName ?? '',
    type: run.isDestroy ? 'Destroy' : 'Plan',
    status: position ? `${label}, number ${position} in line` : label,
    statusTooltip: tooltip,
    startedBy: run.createdBy ?? '',
    createdAt: run.createdAt ?? '',
  };
}

@Component({
  selector: 'cas-active-runs',
  templateUrl: './active-runs.component.html',
  styleUrls: ['./active-runs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatIconButton,
    MatFormField,
    MatSuffix,
    MatIcon,
    MatInput,
    MatPaginator,
    MatProgressSpinner,
    MatSort,
    MatSortHeader,
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
    MatNoDataRow,
    MatTooltip,
    RunComponent,
  ],
})
export class ActiveRunsComponent {
  readonly runs = input<Run[]>(undefined);
  readonly expandedRuns = input<string[]>(undefined);
  readonly workspaces = input<Record<string, RunWorkspace | null>>({});
  readonly loading = input<boolean>(false);

  readonly expandRun = output<{
    expand: boolean;
    item: Run;
  }>();
  readonly planUpdated = output<{
    output: string;
    item: Run;
  }>();
  readonly applyUpdated = output<{
    output: string;
    item: Run;
  }>();

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  readonly displayedColumns = [
    'actions',
    'workspaceName',
    'projectName',
    'type',
    'status',
    'startedBy',
    'createdAt',
  ];
  readonly dataSource = new MatTableDataSource<RunRow>([]);
  filterString = '';
  readonly formatStarted = formatStarted;

  private readonly rows = computed(() =>
    (this.runs() ?? []).map((run) =>
      toRunRow(run, this.workspaces()?.[run.workspaceId]),
    ),
  );

  constructor() {
    this.dataSource.filterPredicate = (row, filter) =>
      [
        row.workspaceName,
        row.projectName,
        row.type,
        row.status,
        row.startedBy,
        formatStarted(row.createdAt),
      ]
        .join(' ')
        .toLowerCase()
        .includes(filter);
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.dataSource.paginator = this.paginator();
      this.dataSource.sort = this.sort();
    });
  }

  applyFilter(value: string) {
    this.dataSource.filter = value.trim().toLowerCase();
  }

  clearFilter() {
    this.filterString = '';
    this.applyFilter('');
  }

  /** Keeps a row, and the output streaming in it, when its run updates. */
  trackByRun = (_index: number, row: RunRow) => row.run.id;

  isExpanded(row: RunRow): boolean {
    return (this.expandedRuns() ?? []).includes(row.run.id);
  }

  toggle(row: RunRow) {
    this.expandRun.emit({ expand: !this.isExpanded(row), item: row.run });
  }

  planOutput(output: string, item: Run) {
    this.planUpdated.emit({ output, item });
  }

  applyOutput(output: string, item: Run) {
    this.applyUpdated.emit({ output, item });
  }
}
