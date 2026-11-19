/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, OnDestroy, OnInit, inject, input } from '@angular/core';
import { Observable } from 'rxjs';
import { Design } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { DesignQuery } from '../../state/design.query';
import { VariableService } from '../../state/variables/variables.service';
import { MatTooltip } from '@angular/material/tooltip';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
  MatExpansionPanelDescription,
  MatExpansionPanelContent,
} from '@angular/material/expansion';
import { VariablesComponent } from '../variables/variables.component';
import { DesignModulesComponent } from '../design-modules/design-modules.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-design',
  templateUrl: './design.component.html',
  styleUrls: ['./design.component.scss'],
  imports: [
    MatTooltip,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatExpansionPanelDescription,
    MatExpansionPanelContent,
    VariablesComponent,
    DesignModulesComponent,
    AsyncPipe,
  ],
})
export class DesignComponent implements OnInit, OnDestroy {
  private designQuery = inject(DesignQuery);
  private variableService = inject(VariableService);
  private signalRService = inject(SignalRService);

  readonly designId = input<string>(undefined);

  readonly canEdit = input<boolean>(undefined);

  design$: Observable<Design>;

  ngOnInit(): void {
    this.design$ = this.designQuery.selectEntity(this.designId());

    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinDesign(this.designId());
      })
      .catch((err) => {
        console.log(err);
      });

    this.loadVariables();
  }

  loadVariables() {
    this.variableService.loadByDesignId(this.designId());
  }

  ngOnDestroy(): void {
    this.signalRService.leaveDesign(this.designId());
  }
}
