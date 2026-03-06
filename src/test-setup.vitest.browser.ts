// Guard against double-import in browser mode shared context
if (!(globalThis as any)['__vitest_zone_patch__']) {
  await import('@analogjs/vitest-angular/setup-zone');
}

// Load Angular Material prebuilt theme for full component styling.
// The app's custom styles.scss uses Material 3 SCSS mixins that require
// Angular CLI's custom Sass importer. Vite's Sass processor doesn't have
// that importer, so we load the prebuilt theme instead for visual fidelity.
import '@angular/material/prebuilt-themes/azure-blue.css';

// Load icon fonts
import '@mdi/font/css/materialdesignicons.css';
import '@fortawesome/fontawesome-free/css/all.css';

// Load Bootstrap utilities (same as angular.json styles config)
import 'bootstrap/scss/bootstrap-utilities.scss';

// Load the app's custom SCSS (toolbar theme, layout, custom component overrides)
import './styles/styles.scss';

import '@testing-library/jest-dom/vitest';

import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize Angular test environment (only once in shared context)
if (!(globalThis as any)['__vitest_angular_testbed_init__']) {
  (globalThis as any)['__vitest_angular_testbed_init__'] = true;
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
    {
      teardown: { destroyAfterEach: false, rethrowErrors: false },
    }
  );
}

// In browser mode, test files share a global context. We must reset TestBed
// before each test to prevent "Cannot configure the test module when the test
// module has already been instantiated" errors.
beforeEach(() => {
  try {
    getTestBed().resetTestingModule();
  } catch (e) {
    // Suppress cleanup errors from child components with async subscriptions
  }

  // Apply the light theme class so Material components render with correct colors
  document.body.classList.add('light-theme');
});
