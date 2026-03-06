// Guard against double-import in browser mode shared context
if (!(globalThis as any)['__vitest_zone_patch__']) {
  await import('@analogjs/vitest-angular/setup-zone');
}

// Load the global application styles (Material theme, MDI icons, Bootstrap, etc.)
// This is the same stylesheet loaded by angular.json in the production build.
// This makes components render identically to the running application.
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
