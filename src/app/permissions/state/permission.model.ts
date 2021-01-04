// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ID } from '@datorama/akita';
import { Permission } from '../../generated/caster-api';

export interface PermissionUi {
  id?: string;
  isSelected: boolean;
  isEditing: boolean;
  isSaved: boolean;
}
