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
import { UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';

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

  form: UntypedFormGroup;

  constructor(private formBuilder: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      name: [this.workspace.name],
      terraformVersion: [this.workspace.terraformVersion],
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
