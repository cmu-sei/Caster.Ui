/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ModuleValue } from 'src/app/generated/caster-api';

export class ModuleField {
  set value(val: string) {
    this.previousValue = this.value;
    this._value = val;
  }

  get value() {
    return this._value;
  }

  private _value: string;

  name = '';
  description = '';
  isOptional = false;
  type = 'string';
  previousValue = this.value;
  changed = false;

  isMultiLine() {
    return !(
      this.type === 'string' ||
      this.type === 'number' ||
      this.type === 'bool'
    );
  }
}

export class ModuleVariablesResult {
  versionId: string;
  moduleName: string;
  variableValues: Array<ModuleValue>;
  versionName: string;
  changedVariables: Array<string>;
}
