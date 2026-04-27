import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [angular({ tsconfig: 'tsconfig.vitest.json' })],
  resolve: {
    alias: [
      { find: 'src/', replacement: path.resolve(__dirname, 'src') + '/' },
      // Older Angular-CLI-era SCSS uses `~pkg` to reference node_modules.
      { find: /^~(.*)/, replacement: '$1' },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: ['src/styles', './node_modules/bootstrap/scss'],
        silenceDeprecations: [
          'import',
          'global-builtin',
          'color-functions',
          'if-function',
        ],
      },
    },
  },
  optimizeDeps: {
    // Pre-bundle all Angular/Material/CDK packages so Vite doesn't discover
    // them mid-test and trigger a page reload that kills in-progress tests.
    include: [
      '@angular/core',
      '@angular/core/testing',
      '@angular/common',
      '@angular/common/http',
      '@angular/forms',
      '@angular/router',
      '@angular/router/testing',
      '@angular/platform-browser',
      '@angular/platform-browser/animations',
      '@angular/platform-browser-dynamic/testing',
      '@angular/cdk/collections',
      '@angular/cdk/drag-drop',
      '@angular/cdk/portal',
      '@angular/material/autocomplete',
      '@angular/material/badge',
      '@angular/material/bottom-sheet',
      '@angular/material/button',
      '@angular/material/button-toggle',
      '@angular/material/card',
      '@angular/material/checkbox',
      '@angular/material/core',
      '@angular/material/dialog',
      '@angular/material/divider',
      '@angular/material/expansion',
      '@angular/material/form-field',
      '@angular/material/icon',
      '@angular/material/icon/testing',
      '@angular/material/input',
      '@angular/material/list',
      '@angular/material/menu',
      '@angular/material/paginator',
      '@angular/material/progress-spinner',
      '@angular/material/select',
      '@angular/material/sidenav',
      '@angular/material/slide-toggle',
      '@angular/material/snack-bar',
      '@angular/material/sort',
      '@angular/material/table',
      '@angular/material/tabs',
      '@angular/material/toolbar',
      '@angular/material/tooltip',
      '@angular/material/tree',
      '@analogjs/vitest-angular/setup-zone',
      '@cmusei/crucible-common',
      '@datorama/akita',
      '@datorama/akita-ng-router-store',
      '@microsoft/signalr',
      '@ngneat/hotkeys',
      '@testing-library/angular',
      '@testing-library/jest-dom/vitest',
      '@testing-library/user-event',
      '@xterm/addon-fit',
      '@xterm/xterm',
      'angular-resizable-element',
      'ngx-clipboard',
      'ngx-monaco-editor-v2',
      'rxjs',
      'rxjs/operators',
      'tslib',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 51300,
  },
  test: {
    globals: true,
    include: ['src/app/**/*.vitest.ts'],
    setupFiles: ['src/test-setup.vitest.browser.ts'],
    reporters: ['default'],
    isolate: true,
    api: {
      host: '0.0.0.0',
      port: 51301,
    },
    browser: {
      enabled: true,
      api: {
        host: '0.0.0.0',
        port: 63315,
      },
    },
  },
});
