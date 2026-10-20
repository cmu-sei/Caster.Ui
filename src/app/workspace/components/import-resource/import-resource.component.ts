// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  EventEmitter,
  Output,
  inject,
  input,
} from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { take } from 'rxjs/operators';
import { ResourceCommandResult } from 'src/app/generated/caster-api';
import { WorkspaceService } from '../../state';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { OutputComponent } from '../output/output.component';

@Component({
  selector: 'cas-import-resource',
  templateUrl: './import-resource.component.html',
  styleUrls: ['./import-resource.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatTooltip,
    OutputComponent,
  ],
})
export class ImportResourceComponent implements OnInit {
  private formBuilder = inject(UntypedFormBuilder);
  private workspaceService = inject(WorkspaceService);

  readonly workspaceId = input<string>(undefined);
  readonly loading = input<boolean>(undefined);

  @Output() importComplete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  message: string = '';

  constructor() {
    const formBuilder = this.formBuilder;

    this.form = formBuilder.group({
      address: ['', Validators.required],
      id: ['', Validators.required],
    });
  }

  ngOnInit(): void {}

  import() {
    this.message = '';
    this.workspaceService
      .import(this.workspaceId(), {
        resourceAddress: this.form.value.address,
        resourceId: this.form.value.id,
      })
      .pipe(take(1))
      .subscribe((result: ResourceCommandResult) => {
        if (result.errors.length > 0) {
          this.message = '';
          result.errors.forEach((x) => (this.message += `${x}\n`));
        } else {
          this.message = `${this.getSuccessOutput()}: imported ${
            this.form.value.address
          }`;
        }
      });
  }

  cancel() {
    this.importComplete.emit(false);
  }

  private getSuccessOutput(): string {
    const successColor = '\u001b[32;1m';
    const resetColor = '\u001b[0m';

    return `${successColor}Success${resetColor}`;
  }
}
