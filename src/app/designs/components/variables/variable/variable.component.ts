/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { VariableService } from 'src/app/designs/state/variables/variables.service';
import { Variable, VariableType } from 'src/app/generated/caster-api';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';

@Component({
  selector: 'cas-variable',
  templateUrl: './variable.component.html',
  styleUrls: ['./variable.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariableComponent implements OnInit, OnChanges {
  @Input()
  public variable: Variable;

  private isSaving = new BehaviorSubject(false);
  public isSaving$ = this.isSaving.asObservable();

  public isEditing = false;
  public isMultiline = false;

  form: UntypedFormGroup;

  public typeOptions = VariableType;

  public pendingChanges = {
    name: false,
    type: false,
    defaultValue: false,
  };

  constructor(
    private variableService: VariableService,
    private confirmDialogService: ConfirmDialogService,
    private formBuilder: UntypedFormBuilder,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      name: [this.variable.name, Validators.required],
      type: [this.variable.type, Validators.required],
      defaultValue: [this.variable.defaultValue],
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.variable && !changes.variable.firstChange) {
      this.updateFormValue('name');
      this.updateFormValue('type');
      this.updateFormValue('defaultValue');
    }
  }

  updateFormValue(propertyName: string) {
    const formControl = this.form?.get(propertyName);
    const val = this.variable[propertyName];

    if (formControl?.pristine) {
      // if we haven't changed this field,
      // accept the new value automatically
      formControl.setValue(val);
      this.pendingChanges[propertyName] = false;
    } else {
      // if new value is the same as our changed value,
      // mark the form field as pristine
      if (val == formControl?.value) {
        formControl.markAsPristine();
      } else {
        this.pendingChanges[propertyName] = true;
      }
    }
  }

  acceptChange(propertyName: string) {
    const formControl = this.form.get(propertyName);

    if (formControl) {
      formControl.setValue(this.variable[propertyName]);
      formControl.markAsPristine();
      this.pendingChanges[propertyName] = false;
    }
  }

  onTypeChanged(value) {
    if (value == 'list' || value == 'map') {
      this.isMultiline = true;
    } else {
      this.isMultiline = false;
    }
  }

  edit() {
    this.isEditing = !this.isEditing;
  }

  cancel() {
    this.isEditing = false;
  }

  save() {
    this.isSaving.next(true);

    this.variableService.edit(this.variable.id, this.form.value).subscribe(
      (x) => {
        this.isSaving.next(false);
        this.form.markAsPristine();
        this.pendingChanges.defaultValue = false;
        this.pendingChanges.name = false;
        this.pendingChanges.type = false;
      },
      (err) => {
        console.log('err');
        this.isSaving.next(false);
      }
    );
  }

  delete() {
    this.confirmDialogService
      .confirmDialog(
        'Delete Variable',
        `Are you sure you want to delete ${this.variable.name}?`
      )
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[this.confirmDialogService.WAS_CANCELLED]) {
          this.variableService.delete(this.variable.id);
        }
      });
  }

  onClipboardSuccess() {
    this.snackBar.open('Copied to clipboard', 'Dismiss');
  }
}
