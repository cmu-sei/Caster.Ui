/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Design } from 'src/app/generated/caster-api';

export interface DesignState extends EntityState<Design> {}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'designs' })
export class DesignStore extends EntityStore<DesignState> {
  constructor() {
    super();
  }
}
