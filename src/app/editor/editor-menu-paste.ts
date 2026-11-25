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
 *
 * Only reads that follow the editor's right-click menu are reported (the
 * editor arms its watch when the menu opens). Monaco also reads the clipboard
 * for its own reasons, such as resolving $CLIPBOARD in snippet suggestions, and
 * those refusals are not the user's Paste.
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
  const detail =
    typeof message === 'string'
      ? message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  if (env.framed && env.frameAllowsClipboardRead === false) {
    return { failure: 'frame', detail };
  }

  // Firefox refuses to query clipboard-read, which reads as unknown here.
  const state = await env.permissions
    ?.query({ name: 'clipboard-read' as PermissionName })
    .then(
      (status) => status.state,
      (): PermissionState | undefined => undefined,
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

/**
 * Shows the message. Return a promise that settles when the user has dismissed
 * it, so the same message is not stacked while it is still on screen.
 */
export type MenuPasteListener = (
  message: string,
  read: MenuPasteRefusal,
) => void | Promise<unknown>;

export interface MenuPasteWatch {
  /** The right-click menu opened: the next refused read is the user's Paste. */
  arm(): void;
  dispose(): void;
}

interface Watcher {
  listener: MenuPasteListener;
  armed: boolean;
}

/**
 * One wrap for every open editor: the first watch installs it, and closing the
 * last restores the browser's own readText. A message is not repeated while it
 * is still showing, since a blocked clipboard refuses every time; once it is
 * dismissed, the next failed Paste says why again.
 */
interface Wrap {
  watchers: Watcher[];
  showing: string | null;
  restore(): void;
}

let wrap: Wrap | null = null;

function install(env: MenuPasteEnvironment): Wrap {
  const clipboard = env.clipboard;
  const own = Object.getOwnPropertyDescriptor(clipboard, 'readText');
  const original = clipboard.readText;
  const state: Wrap = {
    watchers: [],
    showing: null,
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
    value: async (): Promise<string> => {
      try {
        return await (original.call(clipboard) as Promise<string>);
      } catch (error) {
        const watcher = state.watchers[state.watchers.length - 1];
        // Take the arm before awaiting, so one Paste reports at most once.
        const fromMenu = watcher?.armed === true;
        if (watcher) {
          watcher.armed = false;
        }
        if (fromMenu) {
          const read = await describeClipboardRefusal(error, env);
          const message = menuPasteFailureMessage(read);
          if (state.showing !== message) {
            state.showing = message;
            const release = () => {
              if (state.showing === message) {
                state.showing = null;
              }
            };
            Promise.resolve(watcher.listener(message, read)).then(
              release,
              release,
            );
          }
        }
        throw error;
      }
    },
  });

  return state;
}

/**
 * Says why a menu Paste failed while the returned watch is open; the most
 * recently opened editor shows the message. Does nothing where the browser has
 * no clipboard API, as over plain http.
 */
export function watchMenuPaste(
  onFailure: MenuPasteListener,
  env: MenuPasteEnvironment = browserMenuPasteEnvironment(),
): MenuPasteWatch {
  if (typeof env.clipboard?.readText !== 'function') {
    return {
      arm: () => undefined,
      dispose: () => undefined,
    };
  }

  wrap ??= install(env);
  const state = wrap;
  const watcher: Watcher = { listener: onFailure, armed: false };
  state.watchers.push(watcher);

  let disposed = false;
  return {
    arm: () => {
      watcher.armed = true;
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      state.watchers.splice(state.watchers.indexOf(watcher), 1);
      if (state.watchers.length === 0 && wrap === state) {
        state.restore();
        wrap = null;
      }
    },
  };
}
