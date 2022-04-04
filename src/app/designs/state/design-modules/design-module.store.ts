/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import {
  ActiveState,
  EntityState,
  EntityStore,
  StoreConfig,
} from '@datorama/akita';
import { DesignModule } from 'src/app/generated/caster-api';

export interface DesignModuleState
  extends EntityState<DesignModule, string>,
    ActiveState<string> {}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'design-module' })
export class DesignModuleStore extends EntityStore<DesignModuleState> {
  constructor() {
    super();
  }
}
