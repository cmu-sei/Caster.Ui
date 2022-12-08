// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Workspace,
  TerraformVersionsResult,
} from 'src/app/generated/caster-api';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'cas-workspace-edit',
  templateUrl: './workspace-edit.component.html',
  styleUrls: ['./workspace-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceEditComponent implements OnInit {
  @Input() workspace: Workspace;
  @Input() terraformVersions: TerraformVersionsResult;

  @Output() updateWorkspace = new EventEmitter<Partial<Workspace>>();

  form: FormGroup;

  get parallelism() {
    if (this.form) {
      return this.form?.get('parallelism');
    }
  }

  constructor(private formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      name: [],
      terraformVersion: [],
      parallelism: [Validators.min(1), Validators.max(25)],
    });
  }

  ngOnInit(): void {
    this.form.patchValue({
      name: this.workspace.name,
      terraformVersion: this.workspace.terraformVersion,
      parallelism: this.workspace.parallelism,
    });
  }

  save() {
    const update: Partial<Workspace> = {};

    Object.keys(this.form.controls).forEach((name) => {
      const currentControl = this.form.controls[name];

      if (currentControl.dirty) {
        update[name] = currentControl.value;
      }
    });

    this.updateWorkspace.emit(update);
  }

  cancel() {
    this.updateWorkspace.emit(null);
  }

  toggleTooltip(tooltip: MatTooltip) {
    tooltip.disabled = !tooltip.disabled;
    tooltip.toggle();
  }
}
