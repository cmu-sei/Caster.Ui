// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import {
  Module,
  ModuleVersion,
  ModuleValue,
  Variable,
} from '../../../generated/caster-api';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { ModuleField, ModuleVariablesResult } from './module-variables.models';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

@Component({
  selector: 'cas-module-variables',
  templateUrl: './module-variables.component.html',
  styleUrls: ['./module-variables.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleVariablesComponent implements OnInit, OnChanges {
  @Input() name: string;
  @Input() submitButtonText = 'Save';
  @Input() readOnly: boolean;
  @Input() selectedVersionName: string;
  @Input() selectedModule: Module;
  @Input() values: ModuleValue[] = [];
  @Input() isSaving = false;

  // autocomplete sources
  @Input() variables: Variable[] = [];
  @Input() outputs = [];

  @Output() variablesSelected = new EventEmitter<ModuleVariablesResult>();

  selectedVersion: ModuleVersion;
  moduleFields: ModuleField[] = [];
  newName = '';
  form: FormGroup;
  promptForReload = false;
  nameChanged = false;

  constructor(
    private confirmDialogService: ConfirmDialogService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit() {
    this.newName = this.name ?? this.selectedModule.name;
    this.setVersion();
    this.createModuleFields();
    this.createForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.values && !changes.values.firstChange) {
      this.onValuesChanged();
    }

    if (changes.name && !changes.name.firstChange) {
      this.onNameChanged();
    }

    if (changes.isSaving && !changes.isSaving.firstChange) {
      this.onSavingChanged(
        changes.isSaving.currentValue,
        changes.isSaving.previousValue
      );
    }

    if (
      (changes.selectedVersionName &&
        !changes.selectedVersionName.firstChange) ||
      (changes.selectedModule && !changes.selectedModule.firstChange)
    ) {
      if (this.form?.pristine) {
        this.reload();
      } else if (!this.isSaving) {
        this.promptForReload = true;
      }
    }
  }

  createForm(): void {
    this.form = this.formBuilder.group({
      selectedVersion: [this.selectedVersion],
      newName: [{ value: this.newName, disabled: this.readOnly }],
      values: this.createValuesForm(),
    });
  }

  createValuesForm(): FormGroup {
    const controls = {};

    this.moduleFields.forEach((x) => {
      controls[x.name] = [{ value: x.value, disabled: this.readOnly }];
    });

    return this.formBuilder.group(controls);
  }

  createModuleFields() {
    this.moduleFields.length = 0;
    this.selectedVersion.variables.forEach((variable) => {
      const moduleField = new ModuleField();
      moduleField.name = variable.name;
      moduleField.description = variable.description;
      moduleField.isOptional = variable.isOptional;
      moduleField.type = variable.variableType;

      if (this.values) {
        const val = this.values.find((x) => x.name == variable.name);

        if (val) {
          moduleField.value = val.value;
        } else {
          moduleField.value = variable.defaultValue;
        }
      } else {
        moduleField.value = variable.defaultValue;
      }

      moduleField.defaultValue = variable.defaultValue;
      this.moduleFields.push(moduleField);
    });
  }

  onValuesChanged(): void {
    this.moduleFields.forEach((moduleField) => {
      const value = this.values.find((x) => x.name == moduleField.name);
      const formControl = this.form?.get(['values', moduleField.name]);

      moduleField.value = value ? value.value : moduleField.defaultValue;

      if (formControl != null) {
        // if the update was from us or if we didn't change this formControl,
        // update to the new value
        if (this.isSaving || !formControl.dirty) {
          formControl.setValue(value ? value.value : moduleField.defaultValue);
        } else {
          // if the update is different than what we changed it to, mark it as changed
          // if the update is the same as what we changed it to, mark the control as pristine
          // since it is now the same as the latest api value
          if (moduleField.value != formControl.value) {
            moduleField.changed = true;
          } else {
            formControl.markAsPristine();
          }
        }
      }
    });
  }

  onSelectedVersionChanged(version: ModuleVersion) {
    this.selectedVersion = version;
    this.createModuleFields();
    this.createForm();
    this.form.get('selectedVersion')?.markAsDirty(); // ensure submit button is enabled
  }

  onNameChanged() {
    this.newName = this.name ?? this.selectedModule.name;
    const formControl = this.form?.get('newName');

    if (formControl != null) {
      if (this.isSaving || !formControl.dirty) {
        formControl.setValue(this.newName);
      } else {
        this.nameChanged = true;
      }
    }
  }

  onSavingChanged(currentValue: boolean, previousValue: boolean) {
    if (currentValue == false && previousValue == true) {
      this.form.markAsPristine();
      this.moduleFields.forEach((x) => (x.changed = false));
    }
  }

  reload() {
    this.ngOnInit();
    this.promptForReload = false;
  }

  setVersion() {
    if (this.selectedVersionName) {
      const version = this.selectedModule.versions.find(
        (x) => x.name == this.selectedVersionName
      );

      if (version) {
        this.selectedVersion = version;
      }
    }

    if (!this.selectedVersion) {
      this.selectedVersion = this.selectedModule.versions[0];
    }
  }

  acceptValue(value: ModuleField) {
    const formControl = this.form.get(['values', value.name]);

    if (formControl) {
      formControl.setValue(value.value);
      formControl.markAsPristine();
      value.changed = false;
    }
  }

  acceptName() {
    const formControl = this.form.get('newName');

    if (formControl) {
      formControl.setValue(this.newName);
      formControl.markAsPristine();
      this.nameChanged = false;
    }
  }

  autocompleteSelected(
    formControlName: string,
    event: MatAutocompleteSelectedEvent
  ) {
    const formControl = this.form.get(['values', formControlName]);

    if (formControl) {
      formControl.setValue(event.option.value);
      formControl.markAsDirty();
    }
  }

  submit(): void {
    const moduleValues = new Array<ModuleValue>();

    Object.keys(this.form.value.values).forEach((x) => {
      moduleValues.push({
        name: x,
        value: this.form.value.values[x],
      });
    });

    const result: ModuleVariablesResult = {
      versionId: this.selectedVersion.id,
      moduleName: this.form.value.newName,
      variableValues: moduleValues,
      versionName: this.selectedVersion.name,
      changedVariables: this.getChangedVariables(),
    };

    if (this.hasBlankValues()) {
      this.confirmDialogService
        .confirmDialog(
          'Some REQUIRED variable values have been left blank!',
          'Are you sure that you want to insert this module with blank REQUIRED values?',
          { buttonTrueText: 'Insert' }
        )
        .subscribe((x) => {
          if (!x.wasCancelled) {
            // return the snippet command with blank variable values
            this.variablesSelected.emit(result);
          }
        });
    } else {
      // all variables have values. Return the snippet command
      this.variablesSelected.emit(result);
    }
  }

  private getChangedVariables(): Array<string> {
    const valueControls = (this.form.get('values') as FormGroup).controls;
    const changedVariables = Object.entries(valueControls)
      .filter((x) => x[1].dirty)
      .map((x) => x[0]);

    return changedVariables;
  }

  private hasBlankValues() {
    const hasBlankValues = this.moduleFields.some((mv) => {
      if (mv.isOptional) {
        return false;
      }

      const formControl = this.form.get(['values', mv.name]);
      if (formControl == null) {
        return false;
      }

      return !formControl.value || formControl.value.length === 0;
    });

    return hasBlankValues;
  }

  cancel() {
    this.variablesSelected.emit(null);
  }
}
