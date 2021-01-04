// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { Run } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-active-runs',
  templateUrl: './active-runs.component.html',
  styleUrls: ['./active-runs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveRunsComponent implements OnInit {
  @Input() runs: Run[];
  @Input() expandedRuns: string[];

  @Output() expandRun = new EventEmitter<{ expand: boolean; item: Run }>();
  @Output() planUpdated = new EventEmitter<{ output: string; item: Run }>();
  @Output() applyUpdated = new EventEmitter<{ output: string; item: Run }>();

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
