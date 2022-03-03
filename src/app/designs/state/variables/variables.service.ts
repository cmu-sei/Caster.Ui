import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import {
  CreateVariableCommand,
  EditVariableCommand,
  Variable,
  VariablesService,
} from 'src/app/generated/caster-api';
import { VariablesStore } from './variables.store';

@Injectable({ providedIn: 'root' })
export class VariableService {
  constructor(
    private variablesStore: VariablesStore,
    private variablesService: VariablesService
  ) {}

  loadByDesignId(designId: string) {
    this.variablesService
      .getVariablesByDesign(designId)
      .subscribe((x) => this.variablesStore.set(x));
  }

  create(variable: CreateVariableCommand) {
    return this.variablesService.createVariable(variable);
  }

  edit(id: string, variable: EditVariableCommand) {
    return this.variablesService.editVariable(id, variable);
  }

  delete(id: string) {
    this.variablesService.deleteVariable(id).subscribe();
  }

  add(variable: Variable) {
    this.variablesStore.add(variable);
  }

  update(id, variable: Partial<Variable>) {
    this.variablesStore.update(id, variable);
  }

  remove(id: string) {
    this.variablesStore.remove(id);
  }
}
