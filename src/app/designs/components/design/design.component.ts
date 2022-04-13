/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Design } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { DesignQuery } from '../../state/design.query';
import { VariableService } from '../../state/variables/variables.service';

@Component({
  selector: 'cas-design',
  templateUrl: './design.component.html',
  styleUrls: ['./design.component.scss'],
})
export class DesignComponent implements OnInit, OnDestroy {
  @Input()
  designId: string;

  design$: Observable<Design>;

  constructor(
    private designQuery: DesignQuery,
    private variableService: VariableService,
    private signalRService: SignalRService
  ) {}

  ngOnInit(): void {
    this.design$ = this.designQuery.selectEntity(this.designId);

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
