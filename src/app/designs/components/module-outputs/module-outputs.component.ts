/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { ModuleOutput } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-module-outputs',
  templateUrl: './module-outputs.component.html',
  styleUrls: ['./module-outputs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleOutputsComponent implements OnInit {
  @Input()
  moduleName: string;

  @Input()
  outputs: ModuleOutput[];

  constructor() {}

  ngOnInit(): void {}
}
