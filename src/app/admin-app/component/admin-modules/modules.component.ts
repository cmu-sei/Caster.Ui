// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, NgZone, inject } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ModuleService, ModuleQuery } from '../../../modules/state';
import {
  Module,
  ModuleSource,
  ModulesService,
  SystemPermission,
} from '../../../generated/caster-api';
import { EMPTY, Observable } from 'rxjs';
import { catchError, finalize, map, take } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PermissionService } from 'src/app/permissions/permission.service';
import { AdminModuleListComponent } from './modules-list/module-list.component';
import { ModuleSourcesComponent } from './module-sources/module-sources.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-admin-modules',
  templateUrl: './modules.component.html',
  styleUrls: ['./modules.component.css'],
  imports: [ModuleSourcesComponent, AdminModuleListComponent, AsyncPipe],
})
export class AdminModulesComponent implements OnInit {
  zone = inject(NgZone);
  private moduleService = inject(ModuleService);
  private moduleQuery = inject(ModuleQuery);
  private modulesService = inject(ModulesService);
  private permissionService = inject(PermissionService);
  private snackBar = inject(MatSnackBar);

  public modules$: Observable<Module[]>;
  public isLoading$: Observable<boolean>;
  public matcher = new ModuleErrorStateMatcher();
  public isLinear = false;
  public sources: ModuleSource[] = [];
  /** False when the API could not list its sources. */
  public sourcesListed = true;

  /** Syncing and deleting Modules need ManageModules, as the API requires. */
  public canEdit$ = this.permissionService.hasPermission(
    SystemPermission.ManageModules,
  );

  /**
   * Initialize component
   */
  ngOnInit() {
    this.modules$ = this.moduleQuery.selectAll();
    this.isLoading$ = this.moduleQuery.selectLoading();
    this.load();
  }

  /**
   * Load the Modules. Listing them is what reads the sources, so ask how that
   * went once it is done. When the user asked for the refresh, also say in a
   * snack bar which sources failed.
   */
  load(userRequested = false, forceUpdate = false) {
    // With the versions, so the list can show each Module's latest one.
    this.moduleService
      .load(true, true, forceUpdate)
      .pipe(
        take(1),
        finalize(() => this.loadSources(userRequested)),
      )
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe();
  }

  /**
   * Re-read every source and every version, so a moved tag or a changed
   * caster.json without a new tag is picked up too.
   */
  refreshAll() {
    this.load(true, true);
  }

  private loadSources(userRequested = false) {
    this.modulesService
      .getModuleSources()
      .pipe(take(1))
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe({
        next: (sources) => {
          this.sources = sources ?? [];
          this.sourcesListed = true;
          const failed = this.sources.filter((s) => s.error);
          if (userRequested && failed.length) {
            this.showRefreshFailures(failed);
          }
        },
        // An API that does not report its sources yet: say so, not an error.
        error: () => {
          this.sources = [];
          this.sourcesListed = false;
        },
      });
  }

  /** One snack bar for every failed source; the Module Sources list says why. */
  private showRefreshFailures(sources: ModuleSource[]) {
    const names = sources.map((s) => s.name);
    const message =
      names.length === 1
        ? `Module source ${names[0]} couldn't be read`
        : `Module sources ${names.join(', ')} couldn't be read`;
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      verticalPosition: 'top',
      horizontalPosition: 'center',
    });
  }

  loadById(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.loadModuleById(id).pipe(take(1)).subscribe();
  }

  /**
   * Re-read one source by its name, one Module by its Path, or add one GitLab
   * project by its ID, then reload the list.
   */
  refresh(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService
      .createOrUpdateModuleById(id)
      .pipe(
        take(1),
        catchError((error) => {
          const message =
            error.error?.title ||
            error.message ||
            'Couldn\'t refresh the Modules';
          this.snackBar.open(message, 'Dismiss', {
            duration: 5000,
            verticalPosition: 'top',
            horizontalPosition: 'center',
          });
          return EMPTY;
        }),
      )
      .subscribe(() => this.load());
  }

  deleteModule(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.delete(id).pipe(take(1)).subscribe();
  }
} // End Class

/** Error when invalid control is dirty, touched, or submitted. */
export class ModuleErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null,
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}
