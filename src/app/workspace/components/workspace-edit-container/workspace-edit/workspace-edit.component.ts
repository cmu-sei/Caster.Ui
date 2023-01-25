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
import { ValidatorPatterns } from 'src/app/shared/models/validator-patterns';

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

  get name() {
    if (this.form) {
      return this.form?.get('name');
    }
  }

  get azureDestroyFailureThreshold() {
    if (this.form) {
      return this.form?.get('azureDestroyFailureThreshold');
    }
  }

  constructor(private formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      name: [
        '',
        [
          Validators.required,
          Validators.maxLength(90),
          Validators.pattern(ValidatorPatterns.WorkspaceName),
        ],
      ],
      terraformVersion: [],
      parallelism: [Validators.min(1), Validators.max(25)],
      azureDestroyFailureThreshold: [Validators.min(1), Validators.max(10)],
    });
  }

  ngOnInit(): void {
    this.form.patchValue({
      name: this.workspace.name,
      terraformVersion: this.workspace.terraformVersion,
      parallelism: this.workspace.parallelism,
      azureDestroyFailureThreshold: this.workspace.azureDestroyFailureThreshold,
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
}
