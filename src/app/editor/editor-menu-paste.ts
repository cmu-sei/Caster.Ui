// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Monaco's right-click Paste runs inside the page, so it has to ask the browser
 * for the clipboard (navigator.clipboard.readText). When the browser refuses,
 * Monaco logs the error to the console and pastes nothing, so the menu item
 * appears to do nothing. Keyboard paste is unaffected: the browser hands the
 * text to the page itself, with no permission needed.
 *
 * Monaco has no hook for this, and its Paste command can't be replaced without
 * losing what it saves at copy time (whole-line and multi-cursor copies). So
 * this watches the read instead: while an editor is open, a refused
 * readText() says why, then fails exactly as before, and Monaco's Paste is
 * left untouched.
 */

/** Why the browser would not let Caster read the clipboard. */
export type MenuPasteFailure = 'frame' | 'denied' | 'dismissed' | 'other';

export interface MenuPasteRefusal {
  failure: MenuPasteFailure;
  detail?: string;
}

/** The parts of the browser the read depends on, so tests can supply their own. */
export interface MenuPasteEnvironment {
  /** True when Caster is in a frame, e.g. embedded in another app's page. */
  framed: boolean;
  clipboard?: Pick<Clipboard, 'readText'>;
  permissions?: Pick<Permissions, 'query'>;
  /** Whether the frame's permissions policy allows clipboard reading; undefined when the browser cannot say. */
  frameAllowsClipboardRead?: boolean;
}

export function browserMenuPasteEnvironment(): MenuPasteEnvironment {
  const featurePolicy = (
    document as Document & {
      featurePolicy?: { allowsFeature(feature: string): boolean };
    }
  ).featurePolicy;

  return {
    framed: window.top !== window.self,
    clipboard: navigator.clipboard,
    permissions: navigator.permissions,
    frameAllowsClipboardRead: featurePolicy?.allowsFeature('clipboard-read'),
  };
}

/** Works out why the browser refused a clipboard read. */
export async function describeClipboardRefusal(
  error: unknown,
  env: MenuPasteEnvironment,
): Promise<MenuPasteRefusal> {
  // A DOMException is not always an instanceof Error, so read its message directly.
  const message = (error as { message?: unknown } | null)?.message;
  const detail = typeof message === 'string' ? message : String(error);

  if (env.framed && env.frameAllowsClipboardRead === false) {
    return { failure: 'frame', detail };
  }

  // Firefox refuses to query clipboard-read, which reads as unknown here.
  const state = await env.permissions
    ?.query({ name: 'clipboard-read' as PermissionName })
    .then(
      (status) => status.state,
      () => undefined,
    );

  if (state === 'denied') {
    return { failure: 'denied', detail };
  }
  if (state === 'prompt') {
    return { failure: 'dismissed', detail };
  }
  return { failure: 'other', detail };
}

const USE_KEYBOARD = 'Use Ctrl+V (⌘V on a Mac) to paste instead.';

/** What to tell the user, in the order they would act on it. */
export function menuPasteFailureMessage(read: MenuPasteRefusal): string {
  switch (read.failure) {
    case 'frame':
      return `The page that embeds Caster doesn't allow it to read the clipboard. ${USE_KEYBOARD}`;
    case 'denied':
      return `Your browser blocks Caster from reading the clipboard, either in this site's settings or by your organization's policy. ${USE_KEYBOARD} To use Paste from the menu, allow Clipboard in the site settings.`;
    case 'dismissed':
      return `Caster wasn't allowed to read the clipboard because the browser's permission prompt was dismissed. ${USE_KEYBOARD} To use Paste from the menu, allow it when the browser asks.`;
    default:
      return `Caster couldn't read the clipboard${read.detail ? ` (${read.detail})` : ''}. ${USE_KEYBOARD}`;
  }
}

export type MenuPasteListener = (
  message: string,
  read: MenuPasteRefusal,
) => void;

/**
 * One wrap for every open editor: the first watch installs it, and closing the
 * last restores the browser's own readText. Each cause is reported once while
 * the wrap is in place, since a blocked clipboard refuses every time.
 */
let wrap: {
  listeners: MenuPasteListener[];
  reported: Set<MenuPasteFailure>;
  restore(): void;
} | null = null;

function install(env: MenuPasteEnvironment): NonNullable<typeof wrap> {
  const clipboard = env.clipboard!;
  const own = Object.getOwnPropertyDescriptor(clipboard, 'readText');
  const original = clipboard.readText;
  const state: NonNullable<typeof wrap> = {
    listeners: [],
    reported: new Set(),
    restore: () => {
      if (own) {
        Object.defineProperty(clipboard, 'readText', own);
      } else {
        delete (clipboard as { readText?: unknown }).readText;
      }
    },
  };

  Object.defineProperty(clipboard, 'readText', {
    configurable: true,
    writable: true,
    value: async () => {
      try {
        return await original.call(clipboard);
      } catch (error) {
        const read = await describeClipboardRefusal(error, env);
        const listener = state.listeners[state.listeners.length - 1];
        if (listener && !state.reported.has(read.failure)) {
          state.reported.add(read.failure);
          listener(menuPasteFailureMessage(read), read);
        }
        throw error;
      }
    },
  });

  return state;
}

/**
 * Says why a clipboard read failed while the returned watch is open; the most
 * recently opened editor shows the message. Does nothing where the browser has
 * no clipboard API, as over plain http.
 */
export function watchMenuPaste(
  onFailure: MenuPasteListener,
  env: MenuPasteEnvironment = browserMenuPasteEnvironment(),
): { dispose(): void } {
  if (typeof env.clipboard?.readText !== 'function') {
    return { dispose: () => undefined };
  }

  wrap ??= install(env);
  const state = wrap;
  state.listeners.push(onFailure);

  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      state.listeners.splice(state.listeners.indexOf(onFailure), 1);
      if (state.listeners.length === 0 && wrap === state) {
        state.restore();
        wrap = null;
      }
    },
  };
}
