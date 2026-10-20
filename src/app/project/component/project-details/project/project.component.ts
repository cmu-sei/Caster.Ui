// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';
import { ProjectUI } from '../../../state';
import { MatTab } from '@angular/material/tabs';
import { Project } from 'src/app/generated/caster-api';
import { ProjectTabComponent } from '../project-tab/project-tab.component';

@Component({
  selector: 'cas-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectTabComponent],
})
export class ProjectComponent {
  readonly loading = input<boolean>(undefined);
  readonly project = input<Project>(undefined);
  readonly projectUI = input<ProjectUI>(undefined);
  @Output() closeTab: EventEmitter<string> = new EventEmitter<string>();
  @Output() tabChanged: EventEmitter<{
    index: number;
    tab: MatTab;
  }> = new EventEmitter<{ index: number; tab: MatTab }>();
  @Output() breadcrumbClicked: EventEmitter<any> = new EventEmitter<any>();
  constructor() {}
}
