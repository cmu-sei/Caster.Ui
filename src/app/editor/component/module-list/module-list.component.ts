// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { CreateSnippetCommand, Module } from '../../../generated/caster-api';
import { ModuleVariablesComponent } from '../module-variables/module-variables.component';
import {
  MatCard,
  MatCardHeader,
  MatCardTitle,
  MatCardContent,
} from '@angular/material/card';
import {
  MatFormField,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'cas-module-list',
  templateUrl: './module-list.component.html',
  styleUrls: ['./module-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    MatCard,
    MatFormField,
    MatIcon,
    MatPrefix,
    MatInput,
    FormsModule,
    MatIconButton,
    MatSuffix,
    MatTooltip,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    ModuleVariablesComponent,
  ],
})
export class ModuleListComponent implements OnInit {
  @Input() set modules(val: Module[]) {
    this._modules = val.filter((x) =>
      x.versionsCount != null ? x.versionsCount > 0 : true,
    );
    this.updateDataSource();
  }

  @Input() set selectedModule(val: Module) {
    this._selectedModule = val;
    this.updateSelected();
  }
  @Input() isEditing: boolean;

  @Output()
  insertModule: EventEmitter<CreateSnippetCommand> =
    new EventEmitter<CreateSnippetCommand>();
  @Output() getModule: EventEmitter<{ id: string; name: string }> =
    new EventEmitter();
  private _modules: Module[];
  _selectedModule: Module;
  code: string;
  dataSource = new MatTableDataSource<Module>();
  filterString = '';
  isDialogOpen = false;
  variablesDialogRef: MatDialogRef<ModuleVariablesComponent>;
  initialized = false;

  @ViewChild('variablesDialog')
  variablesTemplate: TemplateRef<ModuleVariablesComponent>;

  constructor(public dialog: MatDialog) {}

  ngOnInit(): void {
    this.dataSource.data = this._modules;
    this.initialized = true;
  }

  variablesSelected(command: CreateSnippetCommand) {
    if (this.variablesDialogRef) {
      this.variablesDialogRef.close();
      this.isDialogOpen = false;
    }

    if (command) {
      this.insertModule.emit(command);
    }
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.trim(); // Remove whitespace
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.dataSource.filter = filterValue;
  }

  clearFilter() {
    this.applyFilter('');
  }

  selectModuleFn(module) {
    this.getModule.emit({
      id: module.id,
      name: module.name,
    });
  }
  private updateDataSource() {
    this.dataSource.data = this._modules;
  }

  private updateSelected() {
    if (
      this.initialized &&
      !this.isDialogOpen &&
      !!this._selectedModule &&
      !!this._selectedModule.versions &&
      this._selectedModule.versions.length > 0
    ) {
      this.isDialogOpen = true;
      this.variablesDialogRef = this.dialog.open(this.variablesTemplate, {
        minWidth: '400px',
        maxWidth: '90vw',
      });
    }
  }
}
