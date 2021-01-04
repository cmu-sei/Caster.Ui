// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ID } from '@datorama/akita';
import { User } from '../../generated/caster-api';

export interface UserUi {
  id?: string;
  isSelected: boolean;
  isEditing: boolean;
  isSaved: boolean;
}
