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
import { FormGroup, FormBuilder } from '@angular/forms';

@Component({
  selector: 'cas-directory-edit',
  templateUrl: './directory-edit.component.html',
  styleUrls: ['./directory-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryEditComponent implements OnInit {
  @Input() directory: Directory;
  @Input() terraformVersions: TerraformVersionsResult;

  @Output() updateDirectory = new EventEmitter<Partial<Directory>>();

  form: FormGroup;

  constructor(private formBuilder: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      name: [this.directory.name],
      terraformVersion: [this.directory.terraformVersion],
    });
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
}
