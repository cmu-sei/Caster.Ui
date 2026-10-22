// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import {
  ComnAuthQuery,
  ComnAuthService,
  CrucibleThemeService,
  Theme,
} from '@cmusei/crucible-common';
import { HotkeysService } from '@ngneat/hotkeys';
import { activatedRouteStub } from './test-utils/activated-route';
import { renderComponent } from './test-utils/render-component';
import { CurrentUserQuery } from './users/state';
import { AppComponent } from './app.component';

@Component({ selector: 'cas-test-page', template: '' })
class PageStub {}

@Component({ selector: 'comn-header-bar', template: '', standalone: false })
class HeaderBarStub {}

async function renderApp(queryParams: Record<string, string> = {}) {
  const hotkeys = {
    registerHelpModal: vi.fn(),
    addShortcut: vi.fn(() => EMPTY),
  } satisfies Pick<HotkeysService, 'registerHelpModal' | 'addShortcut'>;
  const theme = {
    applyTheme: vi.fn(),
  } satisfies Pick<CrucibleThemeService, 'applyTheme'>;
  const auth = {
    setUserTheme: vi.fn(),
  } satisfies Pick<ComnAuthService, 'setUserTheme'>;
  const authQuery = {
    userTheme$: of(Theme.DARK),
  } satisfies Pick<ComnAuthQuery, 'userTheme$'>;
  const view = await renderComponent(AppComponent, {
    declarations: [HeaderBarStub],
    providers: [
      { provide: HotkeysService, useValue: hotkeys },
      { provide: CrucibleThemeService, useValue: theme },
      { provide: ComnAuthService, useValue: auth },
      { provide: ComnAuthQuery, useValue: authQuery },
      {
        provide: ActivatedRoute,
        useValue: activatedRouteStub(queryParams).route,
      },
      // The real registry, so the icon registrations can be observed.
      { provide: MatIconRegistry, useClass: MatIconRegistry },
    ],
  });
  return { ...view, hotkeys, theme, auth };
}

describe('AppComponent', () => {
  /**
   * Verifies: the app sets the page title from settings, applies the user's theme, and registers the hotkey help modal.
   * Interacts with: Title (real), ComnAuthQuery.userTheme$ and CrucibleThemeService.applyTheme (stubs), HotkeysService (stub).
   * Data: settings AppTopBarText Caster; user theme dark.
   */
  it('sets the title, theme and hotkey help on start', async () => {
    const { theme, hotkeys } = await renderApp();

    expect(TestBed.inject(Title).getTitle()).toBe('Caster');
    expect(theme.applyTheme).toHaveBeenCalledWith(Theme.DARK);
    expect(hotkeys.registerHelpModal).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: the app registers its named SVG icons, including the Caster logo the admin sidenav uses.
   * Interacts with: MatIconRegistry.addSvgIcon (spied on the real registry).
   * Data: none.
   */
  it('registers the app SVG icons', async () => {
    const addSvgIcon = vi.spyOn(MatIconRegistry.prototype, 'addSvgIcon');

    await renderApp();

    const names = addSvgIcon.mock.calls.map(([name]) => name);
    expect(names).toContain('ic_crucible_caster');
    expect(names).toContain('ic_magnify_search');
    expect(names).toHaveLength(14);
  });

  /**
   * Verifies: a theme query parameter becomes the user's theme.
   * Interacts with: ActivatedRoute.queryParamMap (activatedRouteStub), ComnAuthService.setUserTheme (stub).
   * Data: ?theme=light-theme.
   */
  it('takes the theme from the query string', async () => {
    const { auth } = await renderApp({ theme: Theme.LIGHT });

    expect(auth.setUserTheme).toHaveBeenCalledWith(Theme.LIGHT);
  });

  /**
   * Verifies: a completed navigation is stored as the last route, except for admin routes.
   * Interacts with: the real Router's NavigationEnd events, real CurrentUserStore and CurrentUserQuery.
   * Data: navigation to /projects, then to /admin.
   */
  it('remembers the last non-admin route', async () => {
    await renderApp();
    const router = TestBed.inject(Router);
    router.resetConfig([{ path: '**', component: PageStub }]);

    await router.navigateByUrl('/projects');
    await router.navigateByUrl('/admin');

    expect(TestBed.inject(CurrentUserQuery).getLastRoute()).toBe('/projects');
  });
});
