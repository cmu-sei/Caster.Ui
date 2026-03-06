import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [angular({ tsconfig: 'tsconfig.vitest.json' })],
  resolve: {
    alias: {
      'src/': path.resolve(__dirname, 'src') + '/',
    },
  },
  test: {
    globals: true,
    include: ['src/app/**/*.preview.ts'],
    setupFiles: ['src/test-setup.vitest.browser.ts'],
    reporters: ['default'],
    testTimeout: 0,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
