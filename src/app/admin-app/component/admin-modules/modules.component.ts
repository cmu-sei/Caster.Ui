// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, NgZone } from '@angular/core';
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

@Component({
    selector: 'cas-admin-modules',
    templateUrl: './modules.component.html',
    styleUrls: ['./modules.component.css'],
    standalone: false
})
export class AdminModulesComponent implements OnInit {
  public modules$: Observable<Module[]>;
  public isLoading$: Observable<boolean>;
  public matcher = new ModuleErrorStateMatcher();
  public isLinear = false;
  public failedSources: ModuleSource[] = [];
  public noSources = false;

  public canEdit$ = this.permissionService.hasPermission(
    SystemPermission.ManageWorkspaces
  );

  constructor(
    public zone: NgZone,
    private moduleService: ModuleService,
    private moduleQuery: ModuleQuery,
    private modulesService: ModulesService,
    private permissionService: PermissionService,
    private snackBar: MatSnackBar
  ) {}

  /**
   * Initialize component
   */
  ngOnInit() {
    this.modules$ = this.moduleQuery.selectAll();
    this.isLoading$ = this.moduleQuery.selectLoading();
    this.load();
  }

  load() {
    // Listing the Modules is what syncs the sources, so ask how that went
    // once it is done.
    this.moduleService
      .load(false, true)
      .pipe(
        take(1),
        finalize(() => this.loadSources())
      )
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe();
  }

  /** When an API instance last synced a source, in the viewer's time zone. */
  syncTime(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }

  private loadSources() {
    this.modulesService
      .getModuleSources()
      .pipe(take(1))
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe({
        next: (sources) => {
          this.failedSources = sources.filter((s) => s.error);
          this.noSources = !sources.length;
        },
        // An API that does not report its sources yet: show no warning
        // rather than an error.
        error: () => {
          this.failedSources = [];
          this.noSources = false;
        },
      });
  }

  loadById(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.loadModuleById(id).pipe(take(1)).subscribe();
  }

  createOrUpdateById(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService
      .createOrUpdateModuleById(id)
      .pipe(
        take(1),
        catchError((error) => {
          const message =
            error.error?.title || error.message || 'Failed to update the Modules';
          this.snackBar.open(message, 'Dismiss', {
            duration: 5000,
            verticalPosition: 'top',
            horizontalPosition: 'center',
          });
          return EMPTY;
        })
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
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}
