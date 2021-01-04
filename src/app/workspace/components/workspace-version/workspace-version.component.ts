// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Workspace } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-workspace-version',
  templateUrl: './workspace-version.component.html',
  styleUrls: ['./workspace-version.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceVersionComponent implements OnInit {
  @Input() workspace: Workspace;

  constructor() {}

  ngOnInit(): void {}
}
