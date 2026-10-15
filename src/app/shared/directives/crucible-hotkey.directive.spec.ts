// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { Hotkey, HotkeysService } from '@ngneat/hotkeys';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { renderComponent } from '../../test-utils/render-component';
import { CrucibleHotkeyDirective } from './crucible-hotkey.directive';

/** The relevant part of assets/config/settings.json's Hotkeys block. */
const HOTKEYS: Record<string, Hotkey> = {
  PROJECT_NEW: { keys: 'control.p', group: '', description: 'New Project' },
  FILE_LOCK_TOGGLE: {
    keys: 'control.e',
    group: 'Editor',
    description: 'Unlock / Lock a file',
    allowIn: ['INPUT', 'TEXTAREA'],
  },
  FILE_SAVE: {
    keys: 'control.s',
    group: 'Editor',
    description: 'Save a file',
    allowIn: ['INPUT', 'TEXTAREA'],
  },
};

/**
 * Mirrors editor.component.html: a button that relies on click(), and one
 * that binds (hotkeyFn) as well as (click).
 */
@Component({
  selector: 'cas-hotkey-host',
  standalone: false,
  template: `
    @if (showSave) {
      <button type="button" hotkeyAction="FILE_SAVE" (click)="saved()">
        Save
      </button>
    }
    <button
      type="button"
      hotkeyAction="FILE_LOCK_TOGGLE"
      (click)="lockClicked()"
      (hotkeyFn)="lockToggled($event)"
    >
      Lock
    </button>
    <button type="button" (click)="showSave = false">Close file</button>
  `,
})
class HotkeyHostComponent {
  showSave = true;
  readonly saved = vi.fn();
  readonly lockClicked = vi.fn();
  readonly lockToggled = vi.fn((_event?: KeyboardEvent) => undefined);
}

/**
 * Renders the host with the real HotkeysService. Like AppComponent
 * (app.component.ts:86-93), registers every configured shortcut with
 * addShortcut(); the subscriptions are closed after the test so no keydown
 * listener outlives it on the shared jsdom document.
 */
async function setup(hotkeys: Record<string, Hotkey> = HOTKEYS) {
  const settings: Pick<ComnSettingsService, 'settings'> = {
    settings: { Hotkeys: hotkeys },
  };
  const rendered = await renderComponent(HotkeyHostComponent, {
    declarations: [HotkeyHostComponent, CrucibleHotkeyDirective],
    providers: [{ provide: ComnSettingsService, useValue: settings }],
  });
  const hotkeysService = TestBed.inject(HotkeysService);
  const subscriptions = Object.values(hotkeys).map((h) =>
    hotkeysService.addShortcut(h).subscribe(),
  );
  onTestFinished(() => subscriptions.forEach((s) => s.unsubscribe()));
  return {
    ...rendered,
    host: rendered.fixture.componentInstance,
    user: userEvent.setup(),
  };
}

describe('CrucibleHotkeyDirective', () => {
  /**
   * Verifies: pressing an element's configured hotkey clicks the element when it has no (hotkeyFn) binding.
   * Interacts with: HotkeysService (real), ComnSettingsService.settings.Hotkeys (stub), the host's (click) handler.
   * Data: FILE_SAVE is control.s; the user presses Ctrl+S.
   */
  it('clicks the element for its hotkey', async () => {
    const { host, user } = await setup();

    await user.keyboard('{Control>}s{/Control}');

    expect(host.saved).toHaveBeenCalledTimes(1);
    expect(host.lockClicked).not.toHaveBeenCalled();
    expect(host.lockToggled).not.toHaveBeenCalled();
  });

  /**
   * Verifies: when (hotkeyFn) is bound, the hotkey emits it instead of clicking, and the emission carries no event.
   * Interacts with: HotkeysService (real), the host's (hotkeyFn) and (click) handlers.
   * Data: FILE_LOCK_TOGGLE is control.e; the user presses Ctrl+E.
   */
  it('emits hotkeyFn instead of clicking when it is bound', async () => {
    const { host, user } = await setup();

    await user.keyboard('{Control>}e{/Control}');

    expect(host.lockToggled).toHaveBeenCalledTimes(1);
    // NOTE: hotkeyFn is typed EventEmitter<KeyboardEvent>, but emit() is
    // called with no argument (crucible-hotkey.directive.ts:41).
    expect(host.lockToggled).toHaveBeenCalledWith(undefined);
    expect(host.lockClicked).not.toHaveBeenCalled();
    expect(host.saved).not.toHaveBeenCalled();
  });

  /**
   * Verifies: hotkeys for other actions, and unconfigured key combinations, do nothing to these elements.
   * Interacts with: HotkeysService (real), the host's handlers.
   * Data: Ctrl+P (PROJECT_NEW, no element here) and Ctrl+K (not configured).
   */
  it('ignores hotkeys for other actions', async () => {
    const { host, user } = await setup();

    await user.keyboard('{Control>}p{/Control}');
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('s');

    expect(host.saved).not.toHaveBeenCalled();
    expect(host.lockClicked).not.toHaveBeenCalled();
    expect(host.lockToggled).not.toHaveBeenCalled();
  });

  /**
   * Verifies: after the element is removed from the view, its directive's shortcut callback still runs and clicks the detached element.
   * Interacts with: HotkeysService.onShortcut (real), the Save button (native click listener added by the test).
   * Data: clicking "Close file" removes the Save button with @if, then the user presses Ctrl+S twice.
   */
  it('keeps clicking an element after its view is destroyed', async () => {
    const { host, user } = await setup();
    const save = screen.getByRole('button', { name: 'Save' });
    const nativeClick = vi.fn();
    save.addEventListener('click', nativeClick);

    await user.click(screen.getByRole('button', { name: 'Close file' }));
    expect(save.isConnected).toBe(false);
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
    await user.keyboard('{Control>}s{/Control}');
    await user.keyboard('{Control>}s{/Control}');

    expect(nativeClick).toHaveBeenCalledTimes(2);
    expect(host.saved).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a configured key string that isn't lower-case never triggers its element, because the directive compares it with the library's normalized keys.
   * Interacts with: HotkeysService (real; normalizes 'Control.S' to 'control.s'), a test onShortcut listener.
   * Data: FILE_SAVE configured as 'Control.S'; the user presses Ctrl+S.
   */
  it('never fires for a hotkey configured in mixed case', async () => {
    const { host, user } = await setup({
      ...HOTKEYS,
      FILE_SAVE: { ...HOTKEYS['FILE_SAVE'], keys: 'Control.S' },
    });
    const shortcut = vi.fn(
      (_event: KeyboardEvent, _keys: string, _target: HTMLElement) => undefined,
    );
    onTestFinished(TestBed.inject(HotkeysService).onShortcut(shortcut));

    await user.keyboard('{Control>}s{/Control}');

    // The shortcut did fire, with the normalized keys.
    expect(shortcut).toHaveBeenCalledTimes(1);
    expect(shortcut.mock.calls[0][1]).toBe('control.s');

    expect(host.saved).not.toHaveBeenCalled();
  });
});
