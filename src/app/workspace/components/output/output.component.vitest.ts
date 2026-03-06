// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { OutputComponent } from './output.component';
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
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn();
  }
  return { FitAddon: MockFitAddon };
});

describe('OutputComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(OutputComponent, {
      declarations: [OutputComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have xterm terminal instance', async () => {
    const { fixture } = await renderComponent(OutputComponent, {
      declarations: [OutputComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    expect(fixture.componentInstance.xterm).toBeTruthy();
  });
});
