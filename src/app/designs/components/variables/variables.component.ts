/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { Observable } from 'rxjs';
import { Variable } from 'src/app/generated/caster-api';
import { VariablesQuery } from '../../state/variables/variables.query';
import { VariableService } from '../../state/variables/variables.service';

@Component({
  selector: 'cas-variables',
  templateUrl: './variables.component.html',
  styleUrls: ['./variables.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariablesComponent implements OnInit {
  @Input()
  public designId: string;

  @Input()
  canEdit: boolean;

  public variables$: Observable<Variable[]>;

  constructor(
    private variableService: VariableService,
    private variablesQuery: VariablesQuery
  ) {}

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
