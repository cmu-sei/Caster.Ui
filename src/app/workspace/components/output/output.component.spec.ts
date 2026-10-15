// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { mockMatchMedia } from '../../../test-utils/match-media';
import { renderComponent } from '../../../test-utils/render-component';
import { OutputComponent } from './output.component';

describe('OutputComponent', () => {
  /**
   * Verifies: the component opens a terminal and writes its output into it.
   * Interacts with: the real xterm Terminal (with mockMatchMedia).
   * Data: output "Plan: 1 to add".
   */
  it('writes the output into the terminal', async () => {
    mockMatchMedia();
    const { fixture } = await renderComponent(OutputComponent, {
      inputs: { loading: false, output: 'Plan: 1 to add' },
    });
    await fixture.whenStable();

    const terminal = fixture.componentInstance.xterm;
    expect(fixture.nativeElement.querySelector('.xterm')).not.toBeNull();
    expect(terminal.buffer.active.getLine(0)?.translateToString(true)).toBe(
      'Plan: 1 to add',
    );
  });
});
