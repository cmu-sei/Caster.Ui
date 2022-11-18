// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  EventEmitter,
  Output,
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { take } from 'rxjs/operators';
import { ResourceCommandResult } from 'src/app/generated/caster-api';
import { WorkspaceService } from '../../state';

@Component({
  selector: 'cas-import-resource',
  templateUrl: './import-resource.component.html',
  styleUrls: ['./import-resource.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportResourceComponent implements OnInit {
  @Input() workspaceId: string;
  @Input() loading: boolean;

  @Output() importComplete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  message: string = '';

  constructor(
    private formBuilder: UntypedFormBuilder,
    private workspaceService: WorkspaceService
  ) {
    this.form = formBuilder.group({
      address: ['', Validators.required],
      id: ['', Validators.required],
    });
  }

  ngOnInit(): void {}

  import() {
    this.message = '';
    this.workspaceService
      .import(this.workspaceId, {
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
