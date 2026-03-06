// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RunComponent } from './run.component';
import { renderComponent } from 'src/app/test-utils/render-component';

// Mock xterm and its addons since they require a real DOM
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    options: any = {};
    open = vi.fn();
    loadAddon = vi.fn();
    write = vi.fn();
    clear = vi.fn();
    dispose = vi.fn();
    constructor(_opts?: any) {}
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn();
  }
  return { FitAddon: MockFitAddon };
});

const sharedImports = [
  DragDropModule,
  MatIconModule,
  MatButtonModule,
  MatTooltipModule,
];

describe('RunComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(RunComponent, {
      declarations: [RunComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have xterm terminal instance', async () => {
    const { fixture } = await renderComponent(RunComponent, {
      declarations: [RunComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    expect(fixture.componentInstance.xterm).toBeTruthy();
  });
});
