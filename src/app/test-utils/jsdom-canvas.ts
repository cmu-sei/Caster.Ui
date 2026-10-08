// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * jsdom has no canvas: `HTMLCanvasElement.getContext()` returns null and
 * prints "Not implemented: HTMLCanvasElement's getContext()" to stderr.
 * `@xterm/xterm` probes a 2D context when its module loads, so every spec
 * whose component pulls in the run or output terminal (directly, through a
 * child's compiled template, or through a barrel) would print it. This fake
 * returns the same null without the message.
 *
 * It is listed after `src/test-setup.ts` in the test target's `setupFiles`
 * (angular.json), because it has to run before a spec's module graph loads
 * xterm: the unit-test builder bundles the specs, and esbuild does not keep a
 * side-effect import ahead of a shared chunk, so importing it from a spec is
 * not reliable.
 */
HTMLCanvasElement.prototype.getContext = function getContext() {
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;
