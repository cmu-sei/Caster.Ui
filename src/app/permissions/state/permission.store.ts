// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  EntityState,
  EntityStore,
  EntityUIStore,
  StoreConfig,
} from '@datorama/akita';
import { Permission } from '../../generated/caster-api';
import { Injectable, InjectionToken } from '@angular/core';

export interface PermissionsState extends EntityState<Permission> {}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'permissions' })
export class PermissionStore extends EntityStore<PermissionsState> {
  constructor() {
    super();
  }
}
