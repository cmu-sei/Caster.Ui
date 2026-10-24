/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { ModuleOutput } from 'src/app/generated/caster-api';
import { ModuleOutputComponent } from './module-output/module-output.component';

@Component({
  selector: 'cas-module-outputs',
  templateUrl: './module-outputs.component.html',
  styleUrls: ['./module-outputs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModuleOutputComponent],
})
export class ModuleOutputsComponent implements OnInit {
  readonly moduleName = input<string>(undefined);

  readonly outputs = input<ModuleOutput[]>(undefined);

  constructor() {}

  ngOnInit(): void {}
}
