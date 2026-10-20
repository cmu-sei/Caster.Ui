/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  input,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ModuleOutput } from 'src/app/generated/caster-api';
import { MatIconButton } from '@angular/material/button';
import { ClipboardModule } from 'ngx-clipboard';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'cas-module-output',
  templateUrl: './module-output.component.html',
  styleUrls: ['./module-output.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconButton, ClipboardModule, MatTooltip, MatIcon],
})
export class ModuleOutputComponent implements OnInit {
  private snackBar = inject(MatSnackBar);

  readonly moduleName = input<string>(undefined);

  readonly output = input<ModuleOutput>(undefined);

  ngOnInit(): void {}

  toTerraform(): string {
    return `$\{module.${this.moduleName()}.${this.output().name}}`;
  }

  onClipboardSuccess() {
    this.snackBar.open(`Copied ${this.toTerraform()} to clipboard`, 'Dismiss');
  }
}
