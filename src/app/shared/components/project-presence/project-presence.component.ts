// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectPresenceService } from 'src/app/project/state/project-presence.service';

/** Shown for a user who has no name. */
export const UNKNOWN_USER_NAME = 'Unknown user';

/** Beyond this many, the rest are folded into one "+N" chip. */
export const MAX_SHOWN_PRESENT_USERS = 5;

/** The other users with the open project open, for the top bar. */
@Component({
  selector: 'cas-project-presence',
  templateUrl: './project-presence.component.html',
  styleUrls: ['./project-presence.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatMenuModule, MatTooltipModule],
})
export class ProjectPresenceComponent {
  private readonly presenceService = inject(ProjectPresenceService);

  // A user whose name is empty still has to show as someone.
  readonly users = computed(() =>
    this.presentUsers().map((x) => ({
      id: x.id,
      name: x.name?.trim() || UNKNOWN_USER_NAME,
    })),
  );

  private readonly presentUsers = toSignal(this.presenceService.presentUsers$, {
    initialValue: [],
  });

  readonly shown = computed(() =>
    this.users().slice(0, MAX_SHOWN_PRESENT_USERS),
  );

  readonly hidden = computed(() => this.users().slice(MAX_SHOWN_PRESENT_USERS));

  /** Everyone folded into the "+N" chip, which a menu lists in full. */
  readonly hiddenLabel = computed(
    () => `${this.hidden().length} more: ${this.names(this.hidden())}`,
  );

  /** Names the chips that are shown and counts the rest, so a crowded project doesn't make a long label. */
  readonly label = computed(() => {
    const others = this.hidden().length;
    const names = this.shown().map((x) => x.name);
    const listed =
      others > 0
        ? `${names.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`
        : this.names(this.shown());
    return `Also in this project: ${listed}`;
  });

  private names(users: { name: string }[]): string {
    return users.map((x) => x.name).join(', ');
  }
}
