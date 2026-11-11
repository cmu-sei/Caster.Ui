// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
} from '@angular/core';
import {
  Workspace,
  TerraformVersionsResult,
} from 'src/app/generated/caster-api';
import {
  FormGroup,
  FormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { ValidatorPatterns } from 'src/app/shared/models/validator-patterns';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import {
  MatFormField,
  MatError,
  MatLabel,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { DeploymentLimitsFieldsComponent } from 'src/app/shared/components/deployment-limits/deployment-limits-fields.component';
import {
  DeploymentLimits,
  deploymentLimitsForm,
  deploymentLimitsValue,
} from 'src/app/shared/components/deployment-limits/deployment-limits';

@Component({
  selector: 'cas-workspace-edit',
  templateUrl: './workspace-edit.component.html',
  styleUrls: ['./workspace-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    ReactiveFormsModule,
    MatFormField,
    MatInput,
    MatError,
    MatLabel,
    MatSelect,
    MatOption,
    MatIconButton,
    MatSuffix,
    MatTooltip,
    MatIcon,
    DeploymentLimitsFieldsComponent,
  ],
})
export class WorkspaceEditComponent implements OnInit {
  private formBuilder = inject(FormBuilder);

  readonly workspace = input<Workspace>(undefined);
  readonly terraformVersions = input<TerraformVersionsResult>(undefined);
  readonly maxParallelism = input<number>(undefined);
  /** True for a caller who can set the workspace's own deployment limits (EditProjects). */
  readonly canEditLimits = input<boolean>(false);

  readonly updateWorkspace = output<Partial<Workspace>>();
  /** The workspace's own deployment limits, when they were changed. Emitted before updateWorkspace. */
  readonly updateLimits = output<DeploymentLimits>();

  form: FormGroup;
  limitsForm = deploymentLimitsForm();

  collator = new Intl.Collator('en', {
    numeric: true,
  });
  sortedVersions: string[];

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

  constructor() {
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
      parallelism: [Validators.min(1), Validators.max(this.maxParallelism())],
      azureDestroyFailureThreshold: [Validators.min(1), Validators.max(10)],
    });
  }

  ngOnInit(): void {
    this.form.patchValue({
      name: this.workspace().name,
      terraformVersion: this.workspace().terraformVersion,
      parallelism: this.workspace().parallelism,
      azureDestroyFailureThreshold:
        this.workspace().azureDestroyFailureThreshold,
    });

    this.limitsForm = deploymentLimitsForm(this.workspace());
    if (this.canEditLimits()) {
      this.form.addControl('limits', this.limitsForm);
    }

    this.sortedVersions = this.terraformVersions()
      ?.versions?.sort(this.collator.compare)
      .reverse();
  }

  save() {
    const update: Partial<Workspace> = {};

    if (this.limitsForm.dirty && this.canEditLimits()) {
      this.updateLimits.emit(deploymentLimitsValue(this.limitsForm));
    }

    Object.keys(this.form.controls).forEach((name) => {
      if (name === 'limits') {
        return;
      }
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
