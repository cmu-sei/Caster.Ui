/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, inject, Input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatChipsModule } from '@angular/material/chips';
import { CurrentUserQuery } from 'src/app/users/state';

@Component({
  selector: 'cas-current-user-badge',
  templateUrl: './current-user-badge.component.html',
  standalone: true,
  imports: [MatChipsModule],
})
export class CurrentUserBadgeComponent {
  @Input()
  userId: string;

  private readonly currentUserQuery = inject(CurrentUserQuery);

  private currentUserId = toSignal(
    this.currentUserQuery.select((s) => s.id),
    { initialValue: '' }
  );

  isCurrentUser() {
    return this.userId === this.currentUserId();
  }
}
