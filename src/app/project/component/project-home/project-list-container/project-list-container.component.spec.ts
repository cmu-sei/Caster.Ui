// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import {
  ComnAuthService,
  ComnSettingsService,
  CrucibleThemeService,
} from '@cmusei/crucible-common';
import { User as OidcUser } from 'oidc-client-ts';
import {
  Project,
  ProjectGroupsService,
  ProjectsService,
} from 'src/app/generated/caster-api';
import { TopbarView } from 'src/app/shared/components/top-bar/topbar.models';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  captureUnhandledRejections,
  flush,
} from 'src/app/test-utils/unhandled-rx-errors';
import { CurrentUserQuery } from 'src/app/users/state';
import { ProjectListContainerComponent } from './project-list-container.component';
import { ProjectListComponent } from 'src/app/project/component/project-home/project-list/project-list.component';
import { TopbarComponent } from 'src/app/shared/components/top-bar/topbar.component';

@Component({ selector: 'cas-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<TopbarView>(undefined);
  readonly sidenav = input<unknown>(undefined);
}

@Component({ selector: 'cas-project-list', template: '' })
class ProjectListStub {
  readonly projects = input<Project[]>(undefined);
  readonly isLoading = input<boolean>(undefined);
}

// The test DOM never loads images, so tests fire load or error themselves.
class FakeImage {
  static last: FakeImage | undefined;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() {
    FakeImage.last = this;
  }
}

async function renderProjectContainer(
  authOverrides: Partial<Pick<ComnAuthService, 'logout'>> = {},
  landing: { background?: string; dark?: boolean } = {},
) {
  const projectsApi = {
    getAllProjects: vi.fn((_onlyMine?: boolean) =>
      of<Project[]>([{ id: 'p1', name: 'Range' }]),
    ),
  } satisfies ApiStub<ProjectsService>;
  const auth = {
    user$: of(
      new OidcUser({
        access_token: '',
        token_type: 'Bearer',
        profile: { sub: 'u1', name: 'Ada', iss: '', aud: '', exp: 0, iat: 0 },
      }),
    ),
    logout: vi.fn(() => Promise.resolve()),
    ...authOverrides,
  } satisfies Pick<ComnAuthService, 'user$' | 'logout'>;
  const view = await renderComponent(ProjectListContainerComponent, {
    childStubs: [
      { replace: TopbarComponent, with: TopbarStub },
      { replace: ProjectListComponent, with: ProjectListStub },
    ],
    providers: [
      { provide: ProjectsService, useValue: projectsApi },
      {
        provide: ProjectGroupsService,
        useValue: { getProjectGroups: () => of([]) },
      },
      { provide: ComnAuthService, useValue: auth },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: {
            AppTopBarText: 'Caster',
            AppLandingBackgroundImage: landing.background,
          },
        } satisfies Pick<ComnSettingsService, 'settings'>,
      },
      {
        provide: CrucibleThemeService,
        useValue: { isDarkMode: signal(landing.dark ?? false) },
      },
    ],
  });
  return { ...view, projectsApi };
}

describe('ProjectListContainerComponent', () => {
  /**
   * Verifies: calling logout lets its rejected promise escape (current behavior).
   * Interacts with: ComnAuthService.logout, captureUnhandledRejections.
   * Data: rendered project list container; the sign-out redirect rejects.
   */
  it('leaves a rejected direct logout unhandled', async () => {
    const failure = new Error('sign-out redirect failed');
    const errors = captureUnhandledRejections();
    const { fixture } = await renderProjectContainer({
      logout: () => Promise.reject(failure),
    });

    fixture.componentInstance.logout();
    await flush();

    expect(errors).toEqual([failure]);
  });

  /**
   * Verifies: the home page loads only the user's projects into the project list and records the signed-in user.
   * Interacts with: ProjectsService.getAllProjects (stub), ComnAuthService.user$ (stub), real ProjectService, UserService and CurrentUserQuery.
   * Data: one project p1; signed-in user Ada (u1).
   */
  it('lists the current user projects', async () => {
    const { fixture, projectsApi } = await renderProjectContainer();

    expect(projectsApi.getAllProjects).toHaveBeenCalledWith(true);
    const list: ProjectListStub = fixture.debugElement.query(
      By.directive(ProjectListStub),
    ).componentInstance;
    expect(list.projects().map((p) => p.id)).toEqual(['p1']);
    expect(TestBed.inject(CurrentUserQuery).getValue()).toMatchObject({
      id: 'u1',
      name: 'Ada',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeImage.last = undefined;
  });

  // crucible-common remembers loaded images, so each test uses its own URL.

  /**
   * Verifies: the page shows the background image named in settings once it loads.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, crucibleLandingBackground.
   * Data: AppLandingBackgroundImage set to a relative asset URL; the image load event fires.
   */
  it('shows the landing background once the image loads', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderProjectContainer(
      {},
      { background: '/assets/local/projects-loads.jpg' },
    );

    const page = container.querySelector('.content-container') as HTMLElement;
    expect(FakeImage.last?.src).toBe('/assets/local/projects-loads.jpg');
    expect(page.classList.contains('crucible-landing-background')).toBe(false);

    FakeImage.last!.onload!();
    fixture.detectChanges();

    expect(page.style.getPropertyValue('--crucible-landing-background')).toBe(
      'url("/assets/local/projects-loads.jpg")',
    );
    expect(page.classList.contains('crucible-landing-background')).toBe(true);
  });

  /**
   * Verifies: in dark mode the image gets the near-black tint, so the page stays dark.
   * Interacts with: CrucibleThemeService.isDarkMode (stub), a stubbed Image, crucibleLandingBackground.
   * Data: AppLandingBackgroundImage set; dark mode on; the image load event fires.
   */
  it('tints the landing background in dark mode', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderProjectContainer(
      {},
      { background: '/assets/local/projects-dark.jpg', dark: true },
    );

    FakeImage.last!.onload!();
    fixture.detectChanges();

    const page = container.querySelector('.content-container') as HTMLElement;
    expect(page.style.backgroundImage).toContain('linear-gradient');
    expect(page.style.backgroundImage).toContain('projects-dark.jpg');
  });

  /**
   * Verifies: an image that fails to load leaves the normal page background, as if unset.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, crucibleLandingBackground.
   * Data: AppLandingBackgroundImage set to a missing image; the image error event fires.
   */
  it('keeps the normal background when the image fails to load', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { fixture, container } = await renderProjectContainer(
      {},
      { background: '/assets/local/projects-missing.jpg' },
    );

    FakeImage.last!.onerror?.();
    fixture.detectChanges();

    const page = container.querySelector('.content-container') as HTMLElement;
    expect(page.style.getPropertyValue('--crucible-landing-background')).toBe(
      '',
    );
    expect(page.classList.contains('crucible-landing-background')).toBe(false);
  });

  /**
   * Verifies: without the setting, no image is requested and the normal page background is kept.
   * Interacts with: ComnSettingsService.settings (stub), a stubbed Image, crucibleLandingBackground.
   * Data: AppLandingBackgroundImage unset.
   */
  it('keeps the normal background without the setting', async () => {
    vi.stubGlobal('Image', FakeImage);
    const { container } = await renderProjectContainer();

    expect(FakeImage.last).toBeUndefined();
    const page = container.querySelector('.content-container') as HTMLElement;
    expect(page.classList.contains('crucible-landing-background')).toBe(false);
  });
});
