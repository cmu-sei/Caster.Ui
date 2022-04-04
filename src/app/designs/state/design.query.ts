/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { ModuleOutput } from 'src/app/generated/caster-api';
import { DesignStore, DesignState } from './design.store';

@Injectable({ providedIn: 'root' })
export class DesignQuery extends QueryEntity<DesignState> {
  constructor(protected store: DesignStore) {
    super(store);
  }
}
