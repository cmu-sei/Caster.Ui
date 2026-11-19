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
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectPresenceService } from 'src/app/project/state/project-presence.service';

/** Beyond this many, the rest are folded into one "+N" chip. */
export const MAX_SHOWN_PRESENT_USERS = 5;

/** The other users with the open project open, for the top bar. */
@Component({
  selector: 'cas-project-presence',
  templateUrl: './project-presence.component.html',
  styleUrls: ['./project-presence.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
})
export class ProjectPresenceComponent {
  private readonly presenceService = inject(ProjectPresenceService);

  readonly users = toSignal(this.presenceService.presentUsers$, {
    initialValue: [],
  });

  readonly shown = computed(() =>
    this.users().slice(0, MAX_SHOWN_PRESENT_USERS),
  );

  readonly hidden = computed(() => this.users().slice(MAX_SHOWN_PRESENT_USERS));

  readonly hiddenNames = computed(() =>
    this.hidden()
      .map((x) => x.name)
      .join(', '),
  );

  readonly label = computed(() => {
    const names = this.users().map((x) => x.name);
    return `Also in this project: ${names.join(', ')}`;
  });
}
