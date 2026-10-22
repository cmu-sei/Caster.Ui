/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Design, DesignModule } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { DesignQuery } from '../../state/design.query';
import { DesignModuleQuery } from '../../state/design-modules/design-module.query';
import { VariableService } from '../../state/variables/variables.service';

@Component({
    selector: 'cas-design',
    templateUrl: './design.component.html',
    styleUrls: ['./design.component.scss'],
    standalone: false
})
export class DesignComponent implements OnInit, OnDestroy {
  @Input()
  designId: string;

  @Input()
  canEdit: boolean;

  design$: Observable<Design>;

  /** Enabled modules still holding placeholders, which keep the Design from being enabled. */
  incomplete$: Observable<DesignModule[]>;

  constructor(
    private designQuery: DesignQuery,
    private designModuleQuery: DesignModuleQuery,
    private variableService: VariableService,
    private signalRService: SignalRService
  ) {}

  ngOnInit(): void {
    this.design$ = this.designQuery.selectEntity(this.designId);
    this.incomplete$ = this.designModuleQuery
      .getByDesignId(this.designId)
      .pipe(map((modules) => modules.filter((m) => m.enabled && m.placeholders?.length)));

    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinDesign(this.designId);
      })
      .catch((err) => {
        console.log(err);
      });

    this.loadVariables();
  }

  loadVariables() {
    this.variableService.loadByDesignId(this.designId);
  }

  ngOnDestroy(): void {
    this.signalRService.leaveDesign(this.designId);
  }
}
