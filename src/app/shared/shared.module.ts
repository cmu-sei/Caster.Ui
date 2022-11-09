// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CrucibleHotkeyDirective } from './directives/crucible-hotkey.directive';

@NgModule({
    declarations: [CrucibleHotkeyDirective],
    imports: [CommonModule, BrowserModule],
    exports: [CrucibleHotkeyDirective]
})
export class SharedModule {}
