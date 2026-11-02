// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import {
  MONACO_PASTE_COMMAND,
  MenuPasteEditor,
  MenuPasteEnvironment,
  MenuPasteFailure,
  MenuPasteRead,
  menuPasteFailureMessage,
  readClipboardForMenuPaste,
  registerMenuPaste,
} from './editor-menu-paste';

const refused = () =>
  Promise.reject(
    new DOMException('Read permission denied.', 'NotAllowedError'),
  );

function environment(
  overrides: Partial<MenuPasteEnvironment> = {},
): MenuPasteEnvironment {
  return {
    isSecureContext: true,
    framed: false,
    clipboard: { readText: () => Promise.resolve('terraform') },
    permissions: {
      query: () => Promise.resolve({ state: 'granted' } as PermissionStatus),
    },
    ...overrides,
  };
}

function permission(
  state: PermissionState,
): MenuPasteEnvironment['permissions'] {
  return { query: () => Promise.resolve({ state } as PermissionStatus) };
}

describe('readClipboardForMenuPaste', () => {
  /**
   * Verifies: a readable clipboard returns its text.
   * Interacts with: clipboard.readText (fake).
   * Data: "terraform" on the clipboard.
   */
  it('returns the clipboard text when the browser allows it', async () => {
    expect(await readClipboardForMenuPaste(environment())).toEqual({
      text: 'terraform',
    });
  });

  /**
   * Verifies: each way the browser refuses is told apart, so the message can say why.
   * Interacts with: clipboard.readText (rejects), permissions.query, the frame's permissions policy.
   * Data: one environment per cause.
   */
  it.each<[MenuPasteFailure, Partial<MenuPasteEnvironment>]>([
    ['insecure', { isSecureContext: false }],
    ['unsupported', { clipboard: undefined }],
    [
      'frame',
      {
        framed: true,
        frameAllowsClipboardRead: false,
        clipboard: { readText: refused },
      },
    ],
    [
      'denied',
      { clipboard: { readText: refused }, permissions: permission('denied') },
    ],
    [
      'dismissed',
      { clipboard: { readText: refused }, permissions: permission('prompt') },
    ],
    [
      'other',
      { clipboard: { readText: refused }, permissions: permission('granted') },
    ],
  ])('reports %s', async (failure, overrides) => {
    const read = await readClipboardForMenuPaste(environment(overrides));

    expect(read).toMatchObject({ failure });
  });

  /**
   * Verifies: a framed page whose policy allows clipboard reading is judged by its permission, not as a frame problem.
   * Interacts with: clipboard.readText (rejects), permissions.query.
   * Data: framed, policy allows, permission denied.
   */
  it('blames the permission, not the frame, when the frame allows clipboard reading', async () => {
    const read = await readClipboardForMenuPaste(
      environment({
        framed: true,
        frameAllowsClipboardRead: true,
        clipboard: { readText: refused },
        permissions: permission('denied'),
      }),
    );

    expect(read).toMatchObject({ failure: 'denied' });
  });

  /**
   * Verifies: a browser that refuses to query clipboard-read (Firefox) is reported as other, with the browser's reason.
   * Interacts with: clipboard.readText (rejects), permissions.query (rejects).
   * Data: NotAllowedError "Read permission denied.".
   */
  it('falls back to the browser reason when the permission cannot be queried', async () => {
    const read = await readClipboardForMenuPaste(
      environment({
        clipboard: { readText: refused },
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
    ['insecure', /served over HTTPS/],
    ['unsupported', /doesn't let web pages read the clipboard/],
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

describe('registerMenuPaste', () => {
  function editor(focused = true) {
    return {
      hasTextFocus: () => focused,
      trigger: vi.fn<MenuPasteEditor['trigger']>(),
      focus: vi.fn<MenuPasteEditor['focus']>(),
    } satisfies MenuPasteEditor;
  }

  function monaco(editors: MenuPasteEditor[] = []) {
    let handler: (...args: unknown[]) => unknown = () => undefined;
    const dispose = vi.fn();
    const api = {
      editor: {
        registerCommand: vi.fn(
          (_id: string, h: (...args: unknown[]) => unknown) => {
            handler = h;
            return { dispose };
          },
        ),
        getEditors: () => editors,
      },
    };
    return { api, run: () => handler(), dispose };
  }

  /**
   * Verifies: the command takes over Monaco's Paste id, and disposing it gives the id back.
   * Interacts with: monaco.editor.registerCommand (fake).
   * Data: none.
   */
  it("takes over Monaco's Paste command until disposed", () => {
    const { api, dispose } = monaco();

    const registration = registerMenuPaste(
      api,
      () => null,
      vi.fn(),
      async () => ({ text: '' }),
    );
    registration.dispose();

    expect(api.editor.registerCommand).toHaveBeenCalledWith(
      MONACO_PASTE_COMMAND,
      expect.any(Function),
    );
    expect(dispose).toHaveBeenCalled();
  });

  /**
   * Verifies: a readable clipboard is pasted into the focused editor through Monaco's paste handler.
   * Interacts with: editor.trigger, editor.focus (fakes).
   * Data: "terraform"; one focused and one unfocused editor.
   */
  it('pastes into the focused editor', async () => {
    const focused = editor(true);
    const other = editor(false);
    const { api, run } = monaco([other, focused]);
    const onFailure = vi.fn();
    registerMenuPaste(
      api,
      () => other,
      onFailure,
      async () => ({ text: 'terraform' }),
    );

    await run();

    expect(focused.trigger).toHaveBeenCalledWith('keyboard', 'paste', {
      text: 'terraform',
    });
    expect(other.trigger).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  /**
   * Verifies: with no editor focused, the component's own editor is used.
   * Interacts with: the fallback.
   * Data: "x"; no focused editor.
   */
  it("falls back to the component's editor when none has focus", async () => {
    const own = editor(false);
    const { api, run } = monaco([own]);
    registerMenuPaste(
      api,
      () => own,
      vi.fn(),
      async () => ({ text: 'x' }),
    );

    await run();

    expect(own.trigger).toHaveBeenCalledWith('keyboard', 'paste', {
      text: 'x',
    });
  });

  /**
   * Verifies: a refused read pastes nothing and reports the reason.
   * Interacts with: the onFailure callback.
   * Data: failure denied.
   */
  it('reports why instead of pasting when the browser refuses', async () => {
    const focused = editor(true);
    const { api, run } = monaco([focused]);
    const onFailure = vi.fn<(message: string, read: MenuPasteRead) => void>();
    registerMenuPaste(
      api,
      () => focused,
      onFailure,
      async () => ({ failure: 'denied' }),
    );

    await run();

    expect(focused.trigger).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(
      expect.stringContaining("organization's policy"),
      { failure: 'denied' },
    );
  });

  /**
   * Verifies: an empty clipboard pastes nothing and reports nothing.
   * Interacts with: editor.trigger, the onFailure callback.
   * Data: "".
   */
  it('does nothing with an empty clipboard', async () => {
    const focused = editor(true);
    const { api, run } = monaco([focused]);
    const onFailure = vi.fn();
    registerMenuPaste(
      api,
      () => focused,
      onFailure,
      async () => ({ text: '' }),
    );

    await run();

    expect(focused.trigger).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });
});
