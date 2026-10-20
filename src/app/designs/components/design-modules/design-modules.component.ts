/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, Observable } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import { ModuleVariablesResult } from 'src/app/editor/component/module-variables/module-variables.models';
import { DesignModule, Module, Variable } from 'src/app/generated/caster-api';
import { ModuleQuery, ModuleService } from 'src/app/modules/state';
import { DesignModuleQuery } from '../../state/design-modules/design-module.query';
import { DesignModuleService } from '../../state/design-modules/design-module.service';
import { VariablesQuery } from '../../state/variables/variables.query';
import { toTerraformName } from 'src/app/shared/models/validator-patterns';
import { MatButton } from '@angular/material/button';
import { ModuleListComponent } from '../../../editor/component/module-list/module-list.component';
import { ModuleVariablesComponent } from '../../../editor/component/module-variables/module-variables.component';
import { DesignModuleComponent } from './design-module/design-module.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-design-modules',
  templateUrl: './design-modules.component.html',
  styleUrls: ['./design-modules.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    ModuleListComponent,
    ModuleVariablesComponent,
    DesignModuleComponent,
    AsyncPipe,
  ],
})
export class DesignModulesComponent implements OnInit {
  private moduleService = inject(ModuleService);
  moduleQuery = inject(ModuleQuery);
  private designModulesService = inject(DesignModuleService);
  private designModuleQuery = inject(DesignModuleQuery);
  private variablesQuery = inject(VariablesQuery);
  private dialog = inject(MatDialog);

  @Input()
  designId: string;

  @Input()
  canEdit: boolean;

  // #region showModuleListSubject
  private showModuleListSubject = new BehaviorSubject(false);
  public showModuleList$ = this.showModuleListSubject.asObservable();

  public set showModuleList(val: boolean) {
    this.showModuleListSubject.next(val);
  }

  public get showModuleList() {
    return this.showModuleListSubject.getValue();
  }
  // #endregion

  private savingSubject = new BehaviorSubject(false);
  public saving$ = this.savingSubject.asObservable();

  public modules$ = this.moduleQuery.selectAll();
  public designModules$: Observable<DesignModule[]>;
  public variables$: Observable<Variable[]>;
  public outputs$: Observable<any[]>;

  // the module being added, shown in addDialog until it is saved or cancelled
  public newModule: Module;
  public newModuleName: string;
  private addDialogRef: MatDialogRef<unknown>;

  @ViewChild('addDialog')
  addDialogTemplate: TemplateRef<unknown>;

  ngOnInit(): void {
    this.moduleService.load(false, true).subscribe();
    this.moduleService.loadByDesignId(this.designId, true, true).subscribe();

    this.designModules$ = this.designModuleQuery.getByDesignId(this.designId);
    this.designModulesService.loadByDesignId(this.designId).subscribe();

    this.variables$ = this.variablesQuery.selectByDesignId(this.designId);
    this.outputs$ = this.designModuleQuery.getOutputsByDesignId(this.designId);
  }

  trackByFn(_index, item) {
    return item.id;
  }

  // Open the module's variables before creating it, so it is saved with a version
  // and its required values rather than as an empty module that can't be planned.
  getModuleFn(moduleId: string) {
    this.moduleService
      .loadModuleById(moduleId)
      .pipe(take(1))
      .subscribe((module) => {
        if (!module.versions?.length) {
          return;
        }

        this.newModule = module;
        this.newModuleName = this.uniqueName(toTerraformName(module.name));
        this.addDialogRef = this.dialog.open(this.addDialogTemplate, {
          minWidth: '400px',
          maxWidth: '90vw',
        });
      });
  }

  // Each module is a block in the same generated file, so a repeated name is a
  // duplicate module error; number the default when the name is taken.
  private uniqueName(name: string): string {
    const taken = new Set(
      this.designModuleQuery
        .getAll()
        .filter((x) => x.designId == this.designId)
        .map((x) => x.name),
    );

    let unique = name;
    for (let i = 2; taken.has(unique); i++) {
      unique = `${name}_${i}`;
    }

    return unique;
  }

  onAddComplete(event: ModuleVariablesResult) {
    if (!event) {
      this.addDialogRef?.close();
      return;
    }

    this.savingSubject.next(true);
    this.designModulesService
      .create({
        designId: this.designId,
        moduleId: this.newModule.id,
        name: event.moduleName,
        moduleVersion: event.versionName,
        values: event.variableValues.filter(
          (x) => event.changedVariables.includes(x.name) && !!x.value,
        ),
      })
      .pipe(finalize(() => this.savingSubject.next(false)))
      .subscribe(() => {
        this.addDialogRef?.close();
        this.showModuleList = false;
      });
  }
}
