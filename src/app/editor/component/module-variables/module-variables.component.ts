// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import {
  Module,
  ModuleVersion,
  CreateSnippetCommand,
} from '../../../generated/caster-api';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent } from 'src/app/sei-cwd-common/confirm-dialog/components/confirm-dialog.component';

const WAS_CANCELLED = 'wasCancelled';

@Component({
  selector: 'cas-module-variables',
  templateUrl: './module-variables.component.html',
  styleUrls: ['./module-variables.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleVariablesComponent implements OnInit {
  @Input() selectedModule: Module;
  @Input() readOnly: boolean;
  @Input() isEditing: boolean;

  @Output() variablesSelected = new EventEmitter<CreateSnippetCommand>();

  selectedVersion: ModuleVersion;
  moduleValues: EnteredValue[] = [];
  newName = '';

  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    this.selectedVersion = this.selectedModule.versions[0];
    this.newName = this.selectedModule.name;
    this.setModuleValues();
  }

  setModuleValues() {
    this.moduleValues.length = 0;
    this.selectedVersion.variables.forEach((variable) => {
      const enteredValue = new EnteredValue();
      enteredValue.name = variable.name;
      enteredValue.value = variable.defaultValue;
      enteredValue.description = variable.description;
      enteredValue.isOptional = variable.isOptional;
      enteredValue.type = variable.variableType;

      this.moduleValues.push(enteredValue);
    });
  }

  // Submit or Cancel has been clicked
  onClick(useThis: boolean): void {
    if (useThis) {
      const createSnippetCommand: CreateSnippetCommand = {
        versionId: this.selectedVersion.id,
        moduleName: this.newName,
        variableValues: this.moduleValues,
      };
      const hasBlankValues = this.moduleValues.some((mv) => {
        return !mv.isOptional && (!mv.value || mv.value.length === 0);
      });
      if (hasBlankValues) {
        this.confirmDialog(
          'Some REQUIRED variable values have been left blank!',
          'Are you sure that you want to insert this module with blank REQUIRED values?',
          { buttonTrueText: 'Insert' }
        ).subscribe((result) => {
          if (!result[WAS_CANCELLED]) {
            // return the snippet command with blank variable values
            this.variablesSelected.emit(createSnippetCommand);
          }
        });
      } else {
        // all variables have values. Return the snippet command
        this.variablesSelected.emit(createSnippetCommand);
      }
    } else {
      // Cancel by closing with no return value
      this.variablesSelected.emit(null);
    }
  }

  confirmDialog(
    title: string,
    message: string,
    data?: any
  ): Observable<boolean> {
    let dialogRef: MatDialogRef<ConfirmDialogComponent>;
    dialogRef = this.dialog.open(ConfirmDialogComponent, { data: data || {} });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = message;

    return dialogRef.afterClosed();
  }
}

export class EnteredValue {
  name = '';
  value = '';
  description = '';
  isOptional = false;
  type = 'string';

  isMultiLine() {
    return !(
      this.type === 'string' ||
      this.type === 'number' ||
      this.type === 'bool'
    );
  }
}
