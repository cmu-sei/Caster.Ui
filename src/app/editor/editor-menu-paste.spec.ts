// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MenuPasteEnvironment,
  MenuPasteFailure,
  MenuPasteListener,
  describeClipboardRefusal,
  menuPasteFailureMessage,
  watchMenuPaste,
} from './editor-menu-paste';

const denied = () =>
  new DOMException('Read permission denied.', 'NotAllowedError');

function environment(
  overrides: Partial<MenuPasteEnvironment> = {},
): MenuPasteEnvironment {
  return {
    framed: false,
    clipboard: { readText: () => Promise.resolve('terraform') },
    permissions: permission('granted'),
    ...overrides,
  };
}

function permission(
  state: PermissionState,
): MenuPasteEnvironment['permissions'] {
  return { query: () => Promise.resolve({ state } as PermissionStatus) };
}

/** A clipboard whose readText the browser refuses, as with a policy block. */
function refusingClipboard() {
  return { readText: () => Promise.reject(denied()) };
}

const watches: { dispose(): void }[] = [];

/** Opens a watch that is already armed, as if the right-click menu just opened. */
function watch(onFailure: MenuPasteListener, env: MenuPasteEnvironment) {
  const w = watchMenuPaste(onFailure, env);
  w.arm();
  watches.push(w);
  return w;
}

const refuse = (env: MenuPasteEnvironment) =>
  env.clipboard.readText().catch((): void => undefined);

afterEach(() => {
  watches.splice(0).forEach((w) => w.dispose());
});

describe('describeClipboardRefusal', () => {
  /**
   * Verifies: each way the browser refuses is told apart, so the message can say why.
   * Interacts with: permissions.query, the frame's permissions policy.
   * Data: one environment per cause.
   */
  it.each<[MenuPasteFailure, Partial<MenuPasteEnvironment>]>([
    ['frame', { framed: true, frameAllowsClipboardRead: false }],
    ['denied', { permissions: permission('denied') }],
    ['dismissed', { permissions: permission('prompt') }],
    ['other', { permissions: permission('granted') }],
  ])('reports %s', async (failure, overrides) => {
    const read = await describeClipboardRefusal(
      denied(),
      environment(overrides),
    );

    expect(read).toEqual({ failure, detail: 'Read permission denied.' });
  });

  /**
   * Verifies: a framed page whose policy allows clipboard reading is judged by its permission, not as a frame problem.
   * Interacts with: permissions.query.
   * Data: framed, policy allows, permission denied.
   */
  it('blames the permission, not the frame, when the frame allows clipboard reading', async () => {
    const read = await describeClipboardRefusal(
      denied(),
      environment({
        framed: true,
        frameAllowsClipboardRead: true,
        permissions: permission('denied'),
      }),
    );

    expect(read).toMatchObject({ failure: 'denied' });
  });

  /**
   * Verifies: a browser that refuses to query clipboard-read (Firefox) is reported as other, with the browser's reason.
   * Interacts with: permissions.query (rejects).
   * Data: NotAllowedError "Read permission denied.".
   */
  it('falls back to the browser reason when the permission cannot be queried', async () => {
    const read = await describeClipboardRefusal(
      denied(),
      environment({
        permissions: {
          query: () =>
            Promise.reject(new TypeError('clipboard-read is not a permission')),
        },
      }),
    );

    expect(read).toEqual({
      failure: 'other',
      detail: 'Read permission denied.',
    });
  });
});

describe('menuPasteFailureMessage', () => {
  /**
   * Verifies: every message names the cause and points to keyboard paste.
   * Interacts with: menuPasteFailureMessage.
   * Data: each failure.
   */
  it.each<[MenuPasteFailure, RegExp]>([
    ['frame', /page that embeds Caster/],
    ['denied', /site's settings or by your organization's policy/],
    ['dismissed', /permission prompt was dismissed/],
    ['other', /couldn't read the clipboard \(Read permission denied\.\)/],
  ])('explains %s and offers the keyboard', (failure, cause) => {
    const message = menuPasteFailureMessage({
      failure,
      detail: 'Read permission denied.',
    });

    expect(message).toMatch(cause);
    expect(message).toContain('Ctrl+V (⌘V on a Mac)');
  });
});

describe('watchMenuPaste', () => {
  /**
   * Verifies: a readable clipboard reads through the wrap unchanged and reports nothing.
   * Interacts with: clipboard.readText (fake).
   * Data: "terraform" on the clipboard.
   */
  it('passes a successful read through untouched', async () => {
    const env = environment();
    const onFailure = vi.fn();
    watch(onFailure, env);

    expect(await env.clipboard.readText()).toBe('terraform');
    expect(onFailure).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a refused read says why and still fails the same way, so Monaco's Paste behaves as before.
   * Interacts with: clipboard.readText (refuses), permissions.query.
   * Data: permission denied.
   */
  it('says why a read was refused, then rethrows the same error', async () => {
    const env = environment({
      clipboard: refusingClipboard(),
      permissions: permission('denied'),
    });
    const onFailure = vi.fn<MenuPasteListener>();
    watch(onFailure, env);

    await expect(env.clipboard.readText()).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
    expect(onFailure).toHaveBeenCalledWith(
      expect.stringContaining("organization's policy"),
      { failure: 'denied', detail: 'Read permission denied.' },
    );
  });

  /**
   * Verifies: the same message is not stacked while it is still showing, and is shown again once the user dismisses it.
   * Interacts with: clipboard.readText (refuses), the listener's dismissal promise.
   * Data: permission denied, three menu Pastes.
   */
  it('repeats a message only after it was dismissed', async () => {
    const env = environment({
      clipboard: refusingClipboard(),
      permissions: permission('denied'),
    });
    let dismiss!: () => void;
    const onFailure = vi.fn(
      () => new Promise<void>((resolve) => (dismiss = resolve)),
    );
    const w = watch(onFailure, env);

    await refuse(env);
    w.arm();
    await refuse(env);
    expect(onFailure).toHaveBeenCalledTimes(1);

    dismiss();
    await Promise.resolve();
    w.arm();
    await refuse(env);
    expect(onFailure).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: failures with different details are different messages, so one does not hide the next.
   * Interacts with: clipboard.readText (refuses with two reasons).
   * Data: granted permission, errors "first" then "second".
   */
  it('shows each distinct "other" failure', async () => {
    let reason = 'first';
    const env = environment({
      clipboard: {
        readText: () => Promise.reject(new Error(reason)),
      },
    });
    const onFailure = vi.fn(() => new Promise<void>(() => undefined));
    const w = watch(onFailure, env);

    await refuse(env);
    reason = 'second';
    w.arm();
    await refuse(env);

    expect(onFailure).toHaveBeenCalledTimes(2);
  });

  /**
   * Verifies: a refused read that no menu Paste led to (Monaco's $CLIPBOARD snippets) is not reported, and one menu Paste covers one read.
   * Interacts with: arm, clipboard.readText (refuses).
   * Data: permission denied; read unarmed, then armed with two reads.
   */
  it('reports only reads that follow the menu', async () => {
    const env = environment({
      clipboard: refusingClipboard(),
      permissions: permission('denied'),
    });
    const onFailure = vi.fn();
    const w = watchMenuPaste(onFailure, env);
    watches.push(w);

    await refuse(env);
    expect(onFailure).not.toHaveBeenCalled();

    w.arm();
    await refuse(env);
    await refuse(env);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: with two editors open, closing one keeps the wrap for the other, and closing the last restores the browser's readText.
   * Interacts with: two watches over one clipboard.
   * Data: permission prompt dismissed.
   */
  it('keeps the wrap until the last editor closes', async () => {
    const clipboard = refusingClipboard();
    const original = clipboard.readText;
    const env = environment({ clipboard, permissions: permission('prompt') });
    const first = vi.fn();
    const second = vi.fn();
    const a = watch(first, env);
    const b = watch(second, env);

    b.dispose();
    await clipboard.readText().catch((): void => undefined);
    expect(first).toHaveBeenCalledWith(
      expect.stringContaining('permission prompt was dismissed'),
      expect.anything(),
    );
    expect(second).not.toHaveBeenCalled();

    a.dispose();
    expect(clipboard.readText).toBe(original);
  });

  /**
   * Verifies: the most recently opened editor shows the message.
   * Interacts with: two watches over one clipboard.
   * Data: permission denied.
   */
  it('reports to the most recently opened editor', async () => {
    const env = environment({
      clipboard: refusingClipboard(),
      permissions: permission('denied'),
    });
    const older = vi.fn();
    const newer = vi.fn();
    watch(older, env);
    watch(newer, env);

    await env.clipboard.readText().catch((): void => undefined);

    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();
  });

  /**
   * Verifies: without a clipboard API (plain http) there is nothing to wrap, and disposing is harmless.
   * Interacts with: watchMenuPaste.
   * Data: no clipboard.
   */
  it('does nothing without a clipboard API', () => {
    const w = watch(vi.fn(), environment({ clipboard: undefined }));

    expect(() => w.dispose()).not.toThrow();
  });
});
