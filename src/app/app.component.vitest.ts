// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
} from '@cmusei/crucible-common';
import { HotkeysService } from '@ngneat/hotkeys';
import { CurrentUserQuery, CurrentUserStore } from './users/state';
import { AppComponent } from './app.component';
import { renderComponent } from './test-utils/render-component';

type Theme = 'light-theme' | 'dark-theme';

function setup(
  overrides: {
    initialTheme?: Theme;
    queryTheme?: string | null;
    appTopBarText?: string;
    topBarColor?: string;
    topBarTextColor?: string;
  } = {},
) {
  const {
    initialTheme = 'light-theme',
    queryTheme = null,
    appTopBarText = 'Caster',
    topBarColor = '#0F1D47',
    topBarTextColor = '#FFFFFF',
  } = overrides;

  const userTheme$ = new BehaviorSubject<Theme>(initialTheme);
  const setUserTheme = vi.fn();
  const setTitle = vi.fn();
  const navigate = vi.fn();
  const updateCurrentUser = vi.fn();
  const addShortcut = vi.fn(() => of({}));
  const registerHelpModal = vi.fn();

  return {
    userTheme$,
    setUserTheme,
    setTitle,
    navigate,
    updateCurrentUser,
    providers: [
      { provide: ComnAuthQuery, useValue: { userTheme$ } },
      { provide: ComnAuthService, useValue: { setUserTheme } },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: {
            AppTopBarText: appTopBarText,
            AppTopBarHexColor: topBarColor,
            AppTopBarHexTextColor: topBarTextColor,
            Hotkeys: {},
          },
        },
      },
      {
        provide: Router,
        useValue: { navigate, events: EMPTY },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          queryParamMap: of({
            get: (k: string) => (k === 'theme' ? queryTheme : null),
            has: (k: string) => k === 'theme' && queryTheme != null,
          }),
        },
      },
      { provide: Title, useValue: { setTitle } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      {
        provide: HotkeysService,
        useValue: { addShortcut, registerHelpModal },
      },
      {
        provide: CurrentUserQuery,
        useValue: { select: () => of({}) },
      },
      {
        provide: CurrentUserStore,
        useValue: { update: updateCurrentUser },
      },
      { provide: OverlayContainer, useValue: { getContainerElement: () => document.body } },
    ],
  };
}

describe('AppComponent', () => {
  beforeEach(() => {
    document.body.classList.remove('darkMode');
    document.body.style.removeProperty('--mat-sys-primary');
    document.body.style.removeProperty('--mat-sys-on-primary');
  });

  it('creates the component', async () => {
    const ctx = setup();
    const { fixture } = await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets the document title from AppTopBarText setting', async () => {
    const ctx = setup({ appTopBarText: 'My Caster' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    expect(ctx.setTitle).toHaveBeenCalledWith('My Caster');
  });

  it('applies darkMode body class when theme is dark', async () => {
    const ctx = setup({ initialTheme: 'dark-theme' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    expect(document.body.classList.contains('darkMode')).toBe(true);
  });

  it('calls setUserTheme when ?theme=dark-theme is in the query params', async () => {
    const ctx = setup({ queryTheme: 'dark-theme' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    expect(ctx.setUserTheme).toHaveBeenCalledWith('dark-theme');
  });

  it('coerces unknown theme query param to light', async () => {
    const ctx = setup({ queryTheme: 'some-other-theme' });
    await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    expect(ctx.setUserTheme).toHaveBeenCalledWith('light-theme');
  });

  it('updateLastRoute does not persist /admin routes', async () => {
    const ctx = setup();
    const { fixture } = await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    ctx.updateCurrentUser.mockClear();
    fixture.componentInstance.updateLastRoute('/admin/users');
    expect(ctx.updateCurrentUser).not.toHaveBeenCalled();
  });

  it('updateLastRoute persists non-admin routes', async () => {
    const ctx = setup();
    const { fixture } = await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    ctx.updateCurrentUser.mockClear();
    fixture.componentInstance.updateLastRoute('/project/p1');
    expect(ctx.updateCurrentUser).toHaveBeenCalledWith({ lastRoute: '/project/p1' });
  });

  it('cleans up subscriptions on destroy', async () => {
    const ctx = setup();
    const { fixture } = await renderComponent(AppComponent, {
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: ctx.providers,
    });
    fixture.destroy();
    const callsBefore = ctx.setUserTheme.mock.calls.length;
    ctx.userTheme$.next('dark-theme');
    expect(ctx.setUserTheme.mock.calls.length).toBe(callsBefore);
  });
});
