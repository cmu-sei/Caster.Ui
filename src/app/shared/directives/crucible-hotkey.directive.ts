// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { HotkeysService } from '@ngneat/hotkeys';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[hotkeyAction]',
})
export class CrucibleHotkeyDirective implements AfterViewInit {
  constructor(
    private settingsService: ComnSettingsService,
    private hotkeysService: HotkeysService,
    private el: ElementRef
  ) {}
  private subscription: Subscription;
  @Input() hotkeyAction: string;
  @Output()
  hotkeyFn: EventEmitter<KeyboardEvent> = new EventEmitter<KeyboardEvent>();

  ngAfterViewInit() {
    const hotkeys = this.settingsService.settings.Hotkeys;
    this.hotkeysService.onShortcut((evt, keys, target) => {
      const op = Object.keys(hotkeys).find((k) => {
        const v = hotkeys[k];
        return v.keys === keys ? true : false;
      });
      // Prefer hotkeyFn if defined.
      if (op === this.hotkeyAction) {
        if (this.hotkeyFn.observers.length > 0) {
          this.hotkeyFn.emit();
        } else if (!this.hotkeyFn.observers.length) {
          this.el.nativeElement.click();
        } else {
          console.error('click() or hotkeyFn must be defined.');
        }
      }
    });
  }
}
