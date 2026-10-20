// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  input,
} from '@angular/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

@Component({
  selector: 'cas-output',
  templateUrl: './output.component.html',
  styleUrls: ['./output.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutputComponent implements OnInit, OnChanges, OnDestroy {
  readonly loading = input<boolean>(undefined);
  readonly output = input<string>(undefined);
  @ViewChild('xterm', { static: true, read: ElementRef }) eleXtern: ElementRef;
  xterm: Terminal = new Terminal();
  fitAddon: FitAddon = new FitAddon();
  constructor() {}

  ngOnInit() {
    this.xterm.options.convertEol = true;
    this.xterm.open(this.eleXtern.nativeElement);
    this.xterm.loadAddon(this.fitAddon);
    this.xterm.options.scrollback = 9999999; // there is no infinite scrolling for xterm.  Set number of lines to very large number!
    this.fitAddon.fit();
  }

  ngOnDestroy() {
    this.xterm.dispose();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.output && this.xterm) {
      this.xterm.clear();
      this.xterm.write(changes.output.currentValue);
      this.fitAddon.fit();
    }
  }
}
