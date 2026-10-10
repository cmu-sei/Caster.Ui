// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';
import { renderComponent } from '../../../../test-utils/render-component';
import { ModuleOutputComponent } from './module-output.component';

describe('ModuleOutputComponent', () => {
  /**
   * Verifies: the output shows its name, and Copy Terraform copies the module output reference and confirms it.
   * Interacts with: ngx-clipboard's ClipboardService (stub; jsdom has no clipboard), MatSnackBar (real).
   * Data: module web, output ip.
   */
  it('copies the Terraform reference of the output', async () => {
    // The browser clipboard is an edge; the directive only reads these members.
    const clipboard = {
      isSupported: true,
      isTargetValid: vi.fn(() => false),
      copyFromContent: vi.fn((_content: string) => true),
      pushCopyResponse: vi.fn(),
      destroy: vi.fn(),
    } satisfies Pick<
      ClipboardService,
      | 'isSupported'
      | 'isTargetValid'
      | 'copyFromContent'
      | 'pushCopyResponse'
      | 'destroy'
    >;
    await renderComponent(ModuleOutputComponent, {
      imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        ClipboardModule,
      ],
      providers: [{ provide: ClipboardService, useValue: clipboard }],
      inputs: { moduleName: 'web', output: { name: 'ip', description: 'IP' } },
    });

    expect(screen.getByText('ip')).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Copy Terraform' }));

    expect(clipboard.copyFromContent.mock.calls[0][0]).toBe('${module.web.ip}');
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
  });
});
