// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit, NgZone } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ModuleService, ModuleQuery } from '../../../modules/state';
import { Module } from '../../../generated/caster-api';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'cas-admin-modules',
  templateUrl: './modules.component.html',
  styleUrls: ['./modules.component.css'],
})
export class AdminModulesComponent implements OnInit {
  public modules$: Observable<Module[]>;
  public isLoading$: Observable<boolean>;
  public matcher = new ModuleErrorStateMatcher();
  public isLinear = false;

  constructor(
    public zone: NgZone,
    private moduleService: ModuleService,
    private moduleQuery: ModuleQuery
  ) {}

  /**
   * Initialize component
   */
  ngOnInit() {
    this.modules$ = this.moduleQuery.selectAll();
    this.moduleService
      .load(false, true)
      .pipe(
        take(1)
        // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      )
      .subscribe();
    this.isLoading$ = this.moduleQuery.selectLoading();
  }

  load() {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.load(false, true).pipe(take(1)).subscribe();
  }

  loadById(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.loadModuleById(id).pipe(take(1)).subscribe();
  }

  createOrUpdateById(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.createOrUpdateModuleById(id).pipe(take(1)).subscribe();
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
