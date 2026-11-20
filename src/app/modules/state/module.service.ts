// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
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
  private moduleStore = inject(ModuleStore);
  private modulesService = inject(ModulesService);

  /**
   * Loads every Module. Listing them syncs the module sources first; pass
   * forceUpdate to re-read every version even when a source looks unchanged.
   * includeLatestVersion asks for the name of each Module's highest version without
   * the versions themselves. Loading ends when the request does, whether it
   * succeeded or failed.
   */
  load(
    includeVersions: boolean,
    includeVerionsCount: boolean,
    forceUpdate = false,
    includeLatestVersion = false,
  ): Observable<Module[]> {
    this.moduleStore.setLoading(true);
    return this.modulesService
      .getAllModules(
        includeVersions,
        includeVerionsCount,
        forceUpdate,
        undefined,
        undefined,
        includeLatestVersion,
      )
      .pipe(
        tap((modules: Module[]) => {
          this.upsertMany(modules, includeVersions, includeLatestVersion);
        }),
        // Also when listing fails, so the page's spinner does not stay up.
        finalize(() => this.moduleStore.setLoading(false)),
      );
  }

  loadByDesignId(
    designId: string,
    includeVersions: boolean,
    includeVersionsCount: boolean,
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
        }),
      );
  }

  private upsertMany(
    modules: Module[],
    includeVersions: boolean,
    includeLatestVersion = false,
  ) {
    // A call that does not ask for versions or the latest version does not
    // return them, so don't overwrite any we already have.
    const objs = modules.map((x) => {
      if (!includeVersions) {
        delete x.versions;
      }
      if (!includeLatestVersion) {
        delete x.latestVersion;
      }
      return x;
    });

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
      }),
    );
  }

  /**
   * Syncs one module source, or one module in it. The API answers with no
   * body, so reload the Modules afterwards to see what it synced.
   */
  createOrUpdateModuleById(id: string): Observable<unknown> {
    this.moduleStore.setLoading(true);
    const command: CreateModuleRepositoryCommand = { id };
    return this.modulesService
      .createTerrraformModuleFromRepository(command)
      .pipe(finalize(() => this.moduleStore.setLoading(false)));
  }

  delete(id: string): Observable<string> {
    return this.modulesService.deleteModule(id).pipe(
      tap(() => {
        this.moduleStore.remove(id);
        this.moduleStore.ui.remove(id);
      }),
    );
  }

  createVersionSnippet(
    createSnippetCommand: CreateSnippetCommand,
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
