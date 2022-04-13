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
} from '@angular/core';
import { BehaviorSubject, forkJoin, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { DesignModuleQuery } from 'src/app/designs/state/design-modules/design-module.query';
import { DesignModuleService } from 'src/app/designs/state/design-modules/design-module.service';
import { VariablesQuery } from 'src/app/designs/state/variables/variables.query';
import { ModuleVariablesResult } from 'src/app/editor/component/module-variables/module-variables.models';
import {
  DesignModule,
  EditDesignModuleCommand,
  Module,
  ModuleOutput,
  Variable,
} from 'src/app/generated/caster-api/model/models';
import { ModuleService } from 'src/app/modules/state';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';

@Component({
  selector: 'cas-design-module',
  templateUrl: './design-module.component.html',
  styleUrls: ['./design-module.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignModuleComponent implements OnInit, OnChanges {
  @Input()
  public designModule: DesignModule;

  @Input()
  public module: Module;

  public isEditing = false;
  public showOutputs = false;

  private loadingSubject = new BehaviorSubject(false);
  public loading$ = this.loadingSubject.asObservable();

  private set loading(val: boolean) {
    this.loadingSubject.next(val);
  }

  public variables$: Observable<Variable[]>;

  private outputsSubject = new BehaviorSubject<ModuleOutput[]>([]);
  public outputs$ = this.outputsSubject.asObservable();

  public designOutputs$;

  private savingSubject = new BehaviorSubject(false);
  public saving$ = this.savingSubject.asObservable();

  private set saving(val: boolean) {
    this.savingSubject.next(val);
  }

  constructor(
    private confirmationService: ConfirmDialogService,
    private designModuleService: DesignModuleService,
    private moduleService: ModuleService,
    private variableQuery: VariablesQuery,
    private designModuleQuery: DesignModuleQuery
  ) {}

  ngOnInit(): void {
    this.variables$ = this.variableQuery.selectByDesignId(
      this.designModule.designId
    );

    this.designOutputs$ = this.designModuleQuery.getOutputsByDesignId(
      this.designModule.designId,
      this.designModule.id
    );
  }

  ngOnChanges() {
    if (
      this.module &&
      this.module.versions &&
      this.designModule.moduleVersion
    ) {
      const version = this.module.versions.find(
        (x) => x.name == this.designModule.moduleVersion
      );

      if (version) {
        this.outputsSubject.next(version.outputs);
      }
    }
  }

  delete() {
    this.confirmationService
      .confirmDialog(
        'Delete Module',
        `Are you sure you want to delete ${this.designModule.name}?`
      )
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[this.confirmationService.WAS_CANCELLED]) {
          this.designModuleService.delete(this.designModule.id).subscribe();
        }
      });
  }

  edit() {
    this.showOutputs = false;
    this.isEditing = !this.isEditing;

    if (this.isEditing) {
      // wait on first load, otherwise refresh in background
      // in case signalR missed an update
      if (!this.designModule.values || !this.module.versions) {
        this.loading = true;
      }

      forkJoin({
        designModule: this.designModuleService.load(this.designModule.id),
        module: this.moduleService.loadModuleById(this.module.id),
      }).subscribe(() => {
        this.loading = false;
      });
    }
  }

  toggleOutputs() {
    this.isEditing = false;
    this.showOutputs = !this.showOutputs;

    if (this.showOutputs) {
      this.loading = true;
      this.moduleService.loadModuleById(this.module.id).subscribe(() => {
        this.loading = false;
      });
    }
  }

  toggleEnabled() {
    this.designModuleService.toggleEnabled(this.designModule);
  }

  onEditComplete(event: ModuleVariablesResult) {
    if (!event) {
      this.isEditing = false;
      return;
    }

    let apiCall: Observable<DesignModule>;

    const changedValues = event.variableValues.filter((x) =>
      event.changedVariables.includes(x.name)
    );

    // edit the designModule if any of it's properties changed
    if (
      event.moduleName != this.designModule.name ||
      event.versionName != this.designModule.moduleVersion
    ) {
      const command = {
        designId: this.designModule.designId,
        moduleId: this.module.id,
        moduleVersion: event.versionName,
        name: event.moduleName,
        values: changedValues,
      } as EditDesignModuleCommand;

      apiCall = this.designModuleService.edit(this.designModule.id, command);
    } else if (event.changedVariables.length > 0) {
      // only update the designModule's variable values
      apiCall = this.designModuleService.addOrUpdateValues(
        this.designModule.id,
        {
          values: changedValues,
        }
      );
    }

    if (apiCall) {
      this.saving = true;
      apiCall.subscribe(() => (this.saving = false));
    }
  }
}
