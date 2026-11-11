// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { DeploymentLimitsForm } from './deployment-limits';

/**
 * The four deployment limit fields, for a project or a workspace. Empty is no
 * limit at this level; the limit in force is the lowest of the workspace's,
 * its project's and the global one.
 */
@Component({
  selector: 'cas-deployment-limits-fields',
  template: `
    <fieldset class="limits" [formGroup]="form()">
      <legend>Deployment limits</legend>
      @for (field of fields; track field.key) {
        <mat-form-field>
          <mat-label>{{ field.label }}</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="1"
            autocomplete="off"
            [formControlName]="field.key"
          />
          <mat-hint>Empty for no limit</mat-hint>
          @if (form().controls[field.key].invalid) {
            <mat-error>A whole number from 0</mat-error>
          }
        </mat-form-field>
      }
    </fieldset>
  `,
  styles: `
    .limits {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 16px;
      border: 0;
      margin: 0;
      padding: 0;
    }
    legend {
      padding: 0 0 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    MatError,
  ],
})
export class DeploymentLimitsFieldsComponent {
  readonly form = input.required<DeploymentLimitsForm>();

  readonly fields = [
    { key: 'maxMachines', label: 'Max machines' },
    { key: 'maxVcpu', label: 'Max vCPU' },
    { key: 'maxMemoryGiB', label: 'Max memory (GiB)' },
    { key: 'maxDiskGiB', label: 'Max disk (GiB)' },
  ] as const;
}
