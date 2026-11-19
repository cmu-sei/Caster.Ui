/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable, inject } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { DesignStore, DesignState } from './design.store';

@Injectable({ providedIn: 'root' })
export class DesignQuery extends QueryEntity<DesignState> {
  protected store: DesignStore;

  constructor() {
    const store = inject(DesignStore);

    super(store);

    this.store = store;
  }
}
