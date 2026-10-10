// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { onTestFinished, vi } from 'vitest';

/**
 * jsdom has no `window.matchMedia`. `@xterm/xterm` reads it for the device
 * pixel ratio when a terminal opens (the run and output components), so
 * install a never-matching one for the current test and put the original (if
 * any) back afterwards. Call it before rendering the component.
 */
export function mockMatchMedia(): void {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
  onTestFinished(() => {
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else delete (window as unknown as Record<string, unknown>)['matchMedia'];
  });
}
