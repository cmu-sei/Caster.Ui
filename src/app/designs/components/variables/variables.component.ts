/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  inject,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Variable } from 'src/app/generated/caster-api';
import { VariablesQuery } from '../../state/variables/variables.query';
import { VariableService } from '../../state/variables/variables.service';
import { MatButton } from '@angular/material/button';
import { VariableComponent } from './variable/variable.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-variables',
  templateUrl: './variables.component.html',
  styleUrls: ['./variables.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, VariableComponent, AsyncPipe],
})
export class VariablesComponent implements OnInit {
  private variableService = inject(VariableService);
  private variablesQuery = inject(VariablesQuery);

  @Input()
  public designId: string;

  @Input()
  canEdit: boolean;

  public variables$: Observable<Variable[]>;

  ngOnInit(): void {
    this.variables$ = this.variablesQuery.selectByDesignId(this.designId);
  }

  addVariable() {
    this.variableService
      .create({
        designId: this.designId,
        name: 'New Variable',
      })
      .subscribe();
  }

  trackByFn(index: number, item: Variable) {
    return item.id;
  }
}
