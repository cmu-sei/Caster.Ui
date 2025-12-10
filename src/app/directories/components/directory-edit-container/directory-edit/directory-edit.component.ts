// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import {
  Directory,
  TerraformVersionsResult,
} from 'src/app/generated/caster-api';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCheckboxChange } from '@angular/material/checkbox';

@Component({
  selector: 'cas-directory-edit',
  templateUrl: './directory-edit.component.html',
  styleUrls: ['./directory-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryEditComponent implements OnInit {
  @Input() directory: Directory;
  @Input() terraformVersions: TerraformVersionsResult;
  @Input() maxParallelism: number;

  @Output() updateDirectory = new EventEmitter<Partial<Directory>>();

  form: FormGroup;

  collator = new Intl.Collator('en', {
    numeric: true,
  });
  sortedVersions: string[];

  get parallelism() {
    if (this.form) {
      return this.form?.get('parallelism');
    }
  }

  get azureDestroyFailureThreshold() {
    if (this.form) {
      return this.form?.get('azureDestroyFailureThreshold');
    }
  }

  constructor(private formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      name: [],
      terraformVersion: [],
      parallelism: [Validators.min(1), Validators.max(this.maxParallelism)],
      azureDestroyFailureThreshold: [Validators.min(1), Validators.max(10)],
      azureDestroyFailureThresholdEnabled: [],
    });
  }

  ngOnInit(): void {
    this.form.patchValue({
      name: this.directory.name,
      terraformVersion: this.directory.terraformVersion,
      parallelism: this.directory.parallelism,
      azureDestroyFailureThreshold: this.directory.azureDestroyFailureThreshold,
      azureDestroyFailureThresholdEnabled:
        this.directory.azureDestroyFailureThresholdEnabled,
    });

    if (!this.directory.azureDestroyFailureThresholdEnabled) {
      this.azureDestroyFailureThreshold.disable();
    }

    this.sortedVersions = this.terraformVersions?.versions
      ?.sort(this.collator.compare)
      .reverse();
  }

  save() {
    const update: Partial<Directory> = {};

    Object.keys(this.form.controls).forEach((name) => {
      const currentControl = this.form.controls[name];

      if (currentControl.dirty) {
        update[name] = currentControl.value;
      }
    });

    this.updateDirectory.emit(update);
  }

  cancel() {
    this.updateDirectory.emit(null);
  }

  toggleAzureThresholdEnabled($event: MatCheckboxChange) {
    if ($event.checked) {
      this.azureDestroyFailureThreshold.enable();
    } else {
      this.azureDestroyFailureThreshold.disable();
    }
  }
}
