/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, computed, inject, input } from '@angular/core';
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
  readonly userId = input<string | null>(null);

  private readonly currentUserQuery = inject(CurrentUserQuery);

  private readonly currentUserId = toSignal(
    this.currentUserQuery.select((s) => s.id),
    { initialValue: '' }
  );

  readonly isCurrentUser = computed(() => {
    const userId = this.userId();

    return !!userId && userId === this.currentUserId();
  });
}
