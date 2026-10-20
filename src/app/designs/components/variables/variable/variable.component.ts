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
  Renderer2,
  inject,
} from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { VariableService } from 'src/app/designs/state/variables/variables.service';
import { Variable, VariableType } from 'src/app/generated/caster-api';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  MatCard,
  MatCardHeader,
  MatCardTitle,
  MatCardActions,
  MatCardContent,
} from '@angular/material/card';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { ClipboardModule } from 'ngx-clipboard';
import { MatFormField, MatLabel, MatHint } from '@angular/material/form-field';
import { NgClass, AsyncPipe, KeyValuePipe } from '@angular/common';
import { MatInput } from '@angular/material/input';
import { MatSelect, MatOption } from '@angular/material/select';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';

@Component({
  selector: 'cas-variable',
  templateUrl: './variable.component.html',
  styleUrls: ['./variable.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardActions,
    MatIconButton,
    MatTooltip,
    MatIcon,
    ClipboardModule,
    MatCardContent,
    FormsModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    NgClass,
    MatInput,
    MatHint,
    MatSelect,
    MatOption,
    CdkTextareaAutosize,
    MatButton,
    AsyncPipe,
    KeyValuePipe,
  ],
})
export class VariableComponent implements OnInit, OnChanges {
  private variableService = inject(VariableService);
  private confirmDialogService = inject(CrucibleDialogService);
  private formBuilder = inject(UntypedFormBuilder);
  private snackBar = inject(MatSnackBar);

  @Input()
  public variable: Variable;

  @Input()
  canEdit: boolean;

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

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      name: [
        { value: this.variable.name, disabled: !this.canEdit },
        Validators.required,
      ],
      type: [
        { value: this.variable.type, disabled: !this.canEdit },
        Validators.required,
      ],
      defaultValue: [
        { value: this.variable.defaultValue, disabled: !this.canEdit },
      ],
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

    this.canEdit ? formControl.enable() : formControl.disable();

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
      },
    );
  }

  delete() {
    this.confirmDialogService
      .confirm({
        title: 'Delete Variable',
        message: `Are you sure you want to delete ${this.variable.name}?`,
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.variableService.delete(this.variable.id);
        }
      });
  }

  onClipboardSuccess() {
    this.snackBar.open(
      `Copied ${this.variable.terraform} to clipboard`,
      'Dismiss',
    );
  }
}
