/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  OnChanges,
  inject,
  input,
} from '@angular/core';
import { BehaviorSubject, forkJoin, Observable } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
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
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  MatCard,
  MatCardHeader,
  MatCardTitle,
  MatCardActions,
  MatCardContent,
} from '@angular/material/card';
import { NgClass, AsyncPipe } from '@angular/common';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { ModuleVariablesComponent } from '../../../../editor/component/module-variables/module-variables.component';
import { ModuleOutputsComponent } from '../../module-outputs/module-outputs.component';

@Component({
  selector: 'cas-design-module',
  templateUrl: './design-module.component.html',
  styleUrls: ['./design-module.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    NgClass,
    MatCardHeader,
    MatCardTitle,
    MatCardActions,
    MatIconButton,
    MatTooltip,
    MatIcon,
    MatCardContent,
    ModuleVariablesComponent,
    ModuleOutputsComponent,
    AsyncPipe,
  ],
})
export class DesignModuleComponent implements OnInit, OnChanges {
  private confirmationService = inject(CrucibleDialogService);
  private designModuleService = inject(DesignModuleService);
  private moduleService = inject(ModuleService);
  private variableQuery = inject(VariablesQuery);
  private designModuleQuery = inject(DesignModuleQuery);

  public readonly designModule = input<DesignModule>(undefined);

  public readonly module = input<Module>(undefined);

  readonly canEdit = input<boolean>(undefined);

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

  ngOnInit(): void {
    this.variables$ = this.variableQuery.selectByDesignId(
      this.designModule().designId,
    );

    this.designOutputs$ = this.designModuleQuery.getOutputsByDesignId(
      this.designModule().designId,
      this.designModule().id,
    );
  }

  ngOnChanges() {
    const module = this.module();
    if (module && module.versions && this.designModule().moduleVersion) {
      const version = module.versions.find(
        (x) => x.name == this.designModule().moduleVersion,
      );

      if (version) {
        this.outputsSubject.next(version.outputs);
      }
    }
  }

  delete() {
    this.confirmationService
      .confirm({
        title: 'Delete Module',
        message: `Are you sure that you want to delete ${this.designModule().name}?`,
        confirmText: 'Delete',
      })
      .afterClosed()
      .pipe(take(1))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.designModuleService.delete(this.designModule().id).subscribe();
        }
      });
  }

  edit() {
    this.showOutputs = false;
    this.isEditing = !this.isEditing;

    if (this.isEditing) {
      // wait on first load, otherwise refresh in background
      // in case signalR missed an update
      const designModule = this.designModule();
      const module = this.module();
      if (!designModule.values || !module.versions) {
        this.loading = true;
      }

      forkJoin({
        designModule: this.designModuleService.load(designModule.id),
        module: this.moduleService.loadModuleById(module.id),
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
      this.moduleService.loadModuleById(this.module().id).subscribe(() => {
        this.loading = false;
      });
    }
  }

  toggleEnabled() {
    this.designModuleService.toggleEnabled(this.designModule());
  }

  onEditComplete(event: ModuleVariablesResult) {
    if (!event) {
      this.isEditing = false;
      return;
    }

    let apiCall: Observable<DesignModule>;

    const changedValues = event.variableValues.filter((x) =>
      event.changedVariables.includes(x.name),
    );

    // edit the designModule if any of it's properties changed
    const designModule = this.designModule();
    if (
      event.moduleName != designModule.name ||
      event.versionName != designModule.moduleVersion
    ) {
      const command = {
        moduleId: this.module().id,
        moduleVersion: event.versionName,
        name: event.moduleName,
        values: changedValues,
      } as EditDesignModuleCommand;

      apiCall = this.designModuleService.edit(designModule.id, command);
    } else if (event.changedVariables.length > 0) {
      // only update the designModule's variable values
      apiCall = this.designModuleService.addOrUpdateValues(designModule.id, {
        values: changedValues,
      });
    }

    if (apiCall) {
      this.saving = true;
      apiCall.pipe(finalize(() => (this.saving = false))).subscribe();
    }
  }
}
