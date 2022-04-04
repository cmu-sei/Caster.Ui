/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import {
  AddOrUpdateValuesDesignModuleCommand,
  CreateDesignModuleCommand,
  DesignModule,
  DesignsModulesService,
  EditDesignModuleCommand,
} from 'src/app/generated/caster-api';
import { DesignModuleStore } from './design-module.store';

@Injectable({ providedIn: 'root' })
export class DesignModuleService {
  constructor(
    private designModuleStore: DesignModuleStore,
    private designModulesService: DesignsModulesService
  ) {}

  add(designModule: DesignModule) {
    this.designModuleStore.add(designModule);
  }

  update(id, designModule: Partial<DesignModule>) {
    this.designModuleStore.update(id, designModule);
  }

  remove(id: string) {
    this.designModuleStore.remove(id);
  }

  delete(id: string) {
    return this.designModulesService.deleteDesignModule(id);
  }

  create(command: CreateDesignModuleCommand) {
    return this.designModulesService.createDesignModule(command);
  }

  edit(id: string, command: EditDesignModuleCommand) {
    return this.designModulesService.editDesignModule(id, command);
  }

  addOrUpdateValues(id: string, command: AddOrUpdateValuesDesignModuleCommand) {
    return this.designModulesService.addOrUpdateValuesDesignModule(id, command);
  }

  loadByDesignId(designId: string) {
    return this.designModulesService
      .getDesignModulesByDesign(designId)
      .pipe(tap((x) => this.designModuleStore.set(x)));
  }

  load(id: string) {
    return this.designModulesService
      .getDesignModule(id)
      .pipe(tap((x) => this.designModuleStore.upsert(id, x)));
  }

  toggleEnabled(designModule: DesignModule) {
    if (designModule.enabled) {
      this.designModulesService
        .disableDesignModule(designModule.id)
        .subscribe();
    } else {
      this.designModulesService.enableDesignModule(designModule.id).subscribe();
    }
  }
}
