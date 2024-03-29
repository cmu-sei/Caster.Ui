// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ModuleUi } from '.';
import {
  CreateModuleRepositoryCommand,
  CreateSnippetCommand,
  Module,
  ModulesService,
} from '../../generated/caster-api';
import { isUpdate } from '../../shared/utilities/functions';
import { ModuleStore } from './module.store';

@Injectable({
  providedIn: 'root',
})
export class ModuleService {
  constructor(
    private moduleStore: ModuleStore,
    private modulesService: ModulesService
  ) {}

  load(
    includeVersions: boolean,
    includeVerionsCount: boolean
  ): Observable<Module[]> {
    this.moduleStore.setLoading(true);
    return this.modulesService
      .getAllModules(includeVersions, includeVerionsCount)
      .pipe(
        tap((modules: Module[]) => {
          this.upsertMany(modules, includeVersions);
        }),
        tap(() => {
          this.moduleStore.setLoading(false);
        })
      );
  }

  loadByDesignId(
    designId: string,
    includeVersions: boolean,
    includeVersionsCount: boolean
  ): Observable<Module[]> {
    this.moduleStore.setLoading(true);
    return this.modulesService
      .getAllModules(includeVersions, includeVersionsCount, false, designId)
      .pipe(
        tap((modules: Module[]) => {
          this.upsertMany(modules, includeVersions);
        }),
        tap(() => {
          this.moduleStore.setLoading(false);
        })
      );
  }

  private upsertMany(modules: Module[], includeVersions: boolean) {
    let objs = modules;

    if (!includeVersions) {
      // this call does not include versions, so don't
      // overwrite any we already have
      objs = modules.map((x) => {
        delete x.versions;
        return x;
      });
    }

    this.moduleStore.upsertMany(objs);
  }

  loadModuleById(id: string): Observable<Module> {
    this.moduleStore.setLoading(true);
    return this.modulesService.getModule(id).pipe(
      tap((_module: Module) => {
        this.moduleStore.upsert(_module.id, { ..._module });
        this.setSaved(_module.id, true);
      }),
      tap(() => {
        this.moduleStore.setLoading(false);
      })
    );
  }

  createOrUpdateModuleById(id: string): Observable<Module> {
    this.moduleStore.setLoading(true);
    const command: CreateModuleRepositoryCommand = { id };
    return this.modulesService
      .createTerrraformModuleFromRepository(command)
      .pipe(
        tap((_module: Module) => {
          this.moduleStore.upsert(_module.id, { ..._module });
          this.setSaved(_module.id, true);
        }),
        tap(() => {
          this.moduleStore.setLoading(false);
        })
      );
  }

  delete(id: string): Observable<string> {
    return this.modulesService.deleteModule(id).pipe(
      tap(() => {
        this.moduleStore.remove(id);
        this.moduleStore.ui.remove(id);
      })
    );
  }

  createVersionSnippet(
    createSnippetCommand: CreateSnippetCommand
  ): Observable<string> {
    return this.modulesService.createSnippet(createSnippetCommand);
  }

  toggleSelected(id: string) {
    this.moduleStore.ui.upsert(id, (entity) => {
      return {
        isSelected: isUpdate<ModuleUi>(entity) ? !entity.isSelected : undefined,
      };
    });
  }

  // saved state is not toggled, set explicitly.
  setSaved(id, saved) {
    this.moduleStore.ui.upsert(id, { isSaved: saved });
  }

  setActive(id) {
    this.moduleStore.setActive(id);
    this.moduleStore.ui.setActive(id);
  }
}
