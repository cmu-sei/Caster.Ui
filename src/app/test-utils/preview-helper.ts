/**
 * Helper for visual preview mode.
 *
 * Usage in *.preview.ts files:
 *   await hold();  // Keeps the component visible until the browser is closed
 *
 * Run previews with:
 *   npm run test:vitest:preview -- src/app/.../component.preview.ts
 */
export function hold(): Promise<never> {
  return new Promise(() => {
    // Never resolves — keeps the test (and component) alive
    // so you can inspect the rendered component in the browser.
    // Close the browser or press Ctrl+C to stop.
  });
}
