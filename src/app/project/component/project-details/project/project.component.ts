// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
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
  readonly closeTab = output<string>();
  readonly tabChanged = output<{
    index: number;
    tab: MatTab;
  }>();
  readonly breadcrumbClicked = output<any>();
  constructor() {}
}
