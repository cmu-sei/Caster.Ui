// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
} from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'cas-locking-status',
  templateUrl: './locking-status.component.html',
  styleUrls: ['./locking-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSlideToggle, MatTooltip],
})
export class LockingStatusComponent implements OnInit {
  readonly lockingEnabled = input<boolean>(undefined);
  /** Changing it needs ManageWorkspaces, as the API requires. */
  readonly canManage = input<boolean>(false);
  /** A change is on its way to the API. */
  readonly busy = input<boolean>(false);
  readonly setLockingEnabled = output<boolean>();

  readonly tooltip = computed(() =>
    this.canManage()
      ? 'While on, Caster refuses to plan, apply, destroy or reject runs, change resources or delete Workspaces, for example during maintenance. It turns off by itself when the Caster API restarts.'
      : 'Only users who can manage Workspaces can change this',
  );

  constructor() {}

  ngOnInit() {}

  toggleLocking($event: Event) {
    // The toggle moves only once the API has made the change.
    $event.preventDefault();
    if (!this.canManage() || this.busy() || this.lockingEnabled() == null) {
      return;
    }
    this.setLockingEnabled.emit(!this.lockingEnabled());
  }
}
