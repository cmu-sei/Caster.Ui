// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ProjectObjectType, Breadcrumb } from '../../../state';
import { MatButton } from '@angular/material/button';
import { NgClass } from '@angular/common';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'cas-project-breadcrumb',
  templateUrl: './project-breadcrumb.component.html',
  styleUrls: ['./project-breadcrumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, NgClass, MatIcon],
})
export class ProjectBreadcrumbComponent {
  @Input() useButtonStyleBreadcrumbs: boolean;
  @Input() breadcrumbs: Array<Breadcrumb> = new Array<Breadcrumb>();
  @Output() buttonClick: EventEmitter<any> = new EventEmitter<any>();
  tabType = ProjectObjectType;
  constructor() {}
}
