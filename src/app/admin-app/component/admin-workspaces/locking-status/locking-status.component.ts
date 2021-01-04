// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';

@Component({
  selector: 'cas-locking-status',
  templateUrl: './locking-status.component.html',
  styleUrls: ['./locking-status.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LockingStatusComponent implements OnInit {
  @Input() lockingEnabled: boolean;
  @Output() setLockingEnabled = new EventEmitter<boolean>();

  constructor() {}

  ngOnInit() {}

  toggleLocking($event) {
    $event.preventDefault();
    this.setLockingEnabled.emit(!this.lockingEnabled);
  }
}
