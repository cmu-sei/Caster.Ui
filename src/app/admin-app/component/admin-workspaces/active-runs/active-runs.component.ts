// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { Run } from 'src/app/generated/caster-api';
import { CwdTableComponent } from '../../../../sei-cwd-common/cwd-table/components/cwd-table/cwd-table.component';
import { TableItemContentDirective } from '../../../../sei-cwd-common/cwd-table/directives/table-item-content.directive';
import { RunComponent } from '../../../../workspace/components/run/run.component';

@Component({
  selector: 'cas-active-runs',
  templateUrl: './active-runs.component.html',
  styleUrls: ['./active-runs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CwdTableComponent, TableItemContentDirective, RunComponent],
})
export class ActiveRunsComponent implements OnInit {
  readonly runs = input<Run[]>(undefined);
  readonly expandedRuns = input<string[]>(undefined);

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

  constructor() {}

  ngOnInit() {}

  expand(event) {
    const { expand, item } = event;
    this.expandRun.emit({ expand, item });
  }

  planOutput(output: string, item: Run) {
    this.planUpdated.emit({ output, item });
  }

  applyOutput(output: string, item: Run) {
    this.applyUpdated.emit({ output, item });
  }
}
