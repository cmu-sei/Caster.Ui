// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { User } from 'src/app/generated/caster-api';
import { RoleService } from 'src/app/roles/roles.service.service';
import { ValidatorPatterns } from 'src/app/shared/models/validator-patterns';

@Component({
  selector: 'cas-add-user-dialog',
  standalone: false,
  templateUrl: './add-user-dialog.component.html',
  styleUrls: ['./add-user-dialog.component.scss'],
})
export class AddUserDialogComponent {
  private dialogRef = inject(MatDialogRef<AddUserDialogComponent, User>);
  private formBuilder = inject(NonNullableFormBuilder);
  private roleService = inject(RoleService);

  public roles$ = this.roleService.roles$;

  public form = this.formBuilder.group({
    id: [
      '',
      [Validators.required, Validators.pattern(ValidatorPatterns.Guid)],
    ],
    name: ['', [Validators.required, Validators.minLength(4)]],
    roleId: [''],
  });

  get id() {
    return this.form.controls.id;
  }

  get name() {
    return this.form.controls.name;
  }

  onSubmit(): void {
    const { id, name, roleId } = this.form.getRawValue();

    this.dialogRef.close({
      id,
      name,
      roleId: roleId === '' ? null : roleId,
    });
  }
}
