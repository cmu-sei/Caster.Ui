// Guard against double-import in browser mode shared context
if (!(globalThis as any)['__vitest_zone_patch__']) {
  await import('@analogjs/vitest-angular/setup-zone');
}

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
      teardown: { destroyAfterEach: true },
    }
  );
}

// In browser mode, test files share a global context. We must reset TestBed
// before each test to prevent "Cannot configure the test module when the test
// module has already been instantiated" errors.
beforeEach(() => {
  getTestBed().resetTestingModule();
});
