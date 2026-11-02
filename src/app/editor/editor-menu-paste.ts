// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Monaco's right-click Paste runs inside the page, so it has to ask the browser
 * for the clipboard (navigator.clipboard.readText). When the browser refuses,
 * Monaco logs the error to the console and pastes nothing, so the menu item
 * appears to do nothing. Keyboard paste is unaffected: the browser hands the
 * text to the page itself, with no permission needed.
 *
 * This replaces the command behind that menu item with one that does the same
 * read, and on failure says why, so the user knows what to do instead.
 */

/** Monaco's id for its Paste action, used by the editor's context menu. */
export const MONACO_PASTE_COMMAND = 'editor.action.clipboardPasteAction';

/** Why the browser would not let Caster read the clipboard. */
export type MenuPasteFailure =
  'insecure' | 'unsupported' | 'frame' | 'denied' | 'dismissed' | 'other';

export type MenuPasteRead =
  { text: string } | { failure: MenuPasteFailure; detail?: string };

/** The parts of the browser the read depends on, so tests can supply their own. */
export interface MenuPasteEnvironment {
  isSecureContext: boolean;
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
    isSecureContext: window.isSecureContext,
    framed: window.top !== window.self,
    clipboard: navigator.clipboard,
    permissions: navigator.permissions,
    frameAllowsClipboardRead: featurePolicy?.allowsFeature('clipboard-read'),
  };
}

/** Reads the clipboard the way Monaco does, and works out why when it cannot. */
export async function readClipboardForMenuPaste(
  env: MenuPasteEnvironment = browserMenuPasteEnvironment(),
): Promise<MenuPasteRead> {
  // Over plain http the clipboard API does not exist at all.
  if (!env.isSecureContext) {
    return { failure: 'insecure' };
  }

  if (typeof env.clipboard?.readText !== 'function') {
    return { failure: 'unsupported' };
  }

  try {
    return { text: await env.clipboard.readText() };
  } catch (error) {
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
}

const USE_KEYBOARD = 'Use Ctrl+V (⌘V on a Mac) to paste instead.';

/** What to tell the user, in the order they would act on it. */
export function menuPasteFailureMessage(
  read: Extract<MenuPasteRead, { failure: MenuPasteFailure }>,
): string {
  switch (read.failure) {
    case 'insecure':
      return `Paste from the menu needs Caster to be served over HTTPS. ${USE_KEYBOARD}`;
    case 'unsupported':
      return `This browser doesn't let web pages read the clipboard, so Paste from the menu can't work. ${USE_KEYBOARD}`;
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

/** The editor surface the command needs: Monaco's ICodeEditor, narrowed for tests. */
export interface MenuPasteEditor {
  hasTextFocus(): boolean;
  trigger(source: string, handlerId: string, payload: unknown): void;
  focus(): void;
}

/** The Monaco API surface the command needs: monaco.editor, narrowed for tests. */
export interface MenuPasteMonaco {
  editor: {
    registerCommand(
      id: string,
      handler: (...args: unknown[]) => unknown,
    ): { dispose(): void };
    getEditors?(): MenuPasteEditor[];
  };
}

/**
 * Takes over Monaco's Paste command. The latest registration of a command id
 * wins, and disposing it restores Monaco's own. Pastes into whichever editor
 * has text focus, or `fallback` when none does.
 */
export function registerMenuPaste(
  monacoApi: MenuPasteMonaco,
  fallback: () => MenuPasteEditor | null | undefined,
  onFailure: (message: string, read: MenuPasteRead) => void,
  read: () => Promise<MenuPasteRead> = () => readClipboardForMenuPaste(),
): { dispose(): void } {
  return monacoApi.editor.registerCommand(MONACO_PASTE_COMMAND, async () => {
    const editor =
      monacoApi.editor
        .getEditors?.()
        .find((candidate) => candidate.hasTextFocus()) ?? fallback();

    if (!editor) {
      return;
    }

    const result = await read();

    if ('text' in result) {
      if (result.text) {
        // The same handler Monaco's own paste ends in.
        editor.trigger('keyboard', 'paste', { text: result.text });
      }
      editor.focus();
      return;
    }

    onFailure(menuPasteFailureMessage(result), result);
  });
}
