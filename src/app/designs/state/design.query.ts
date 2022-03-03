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
