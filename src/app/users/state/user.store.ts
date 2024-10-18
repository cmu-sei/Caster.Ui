// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { Theme } from '@cmusei/crucible-common';
import {
  EntityState,
  EntityStore,
  EntityUIStore,
  Store,
  StoreConfig,
} from '@datorama/akita';
import { User } from '../../generated/caster-api';
import { UserUi } from './user.model';

export interface UsersState extends EntityState<User> {}
export interface UserUIState extends EntityState<UserUi> {}

export const initialUserUiState: UserUi = {
  isSelected: false,
  isEditing: false,
  isSaved: false,
};

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'users' })
export class UserStore extends EntityStore<UsersState> {
  ui: EntityUIStore<UserUIState>;
  constructor() {
    super();
    this.createUIStore().setInitialEntityState((entity) => ({
      ...initialUserUiState,
    }));
  }
}

export interface CurrentUserState {
  name: string;
  id: string;
  theme?: Theme;
  lastRoute: string;
}

export function createInitialCurrentUserState(): CurrentUserState {
  return {
    name: '',
    id: '',
    theme: Theme.LIGHT,
    lastRoute: '',
  };
}

@Injectable({
  providedIn: 'root',
})
@StoreConfig({ name: 'currentUser' })
export class CurrentUserStore extends Store<CurrentUserState> {
  constructor() {
    super(createInitialCurrentUserState());
  }
}
