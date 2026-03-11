// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { By } from '@angular/platform-browser';
import { TopbarComponent } from './topbar.component';
import { TopbarView } from './topbar.models';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { CurrentUserQuery } from 'src/app/users/state';
import { ComnAuthService } from '@cmusei/crucible-common';
import {
  SystemPermission,
  ProjectPermission,
  ProjectPermissionsClaim,
} from 'src/app/generated/caster-api';

const sharedImports = [
  CommonModule,
  MatToolbarModule,
  MatMenuModule,
  MatButtonModule,
  MatSlideToggleModule,
  MatIconModule,
];

function userProvider(name: string) {
  return {
    provide: CurrentUserQuery,
    useValue: {
      userTheme$: of('light-theme'),
      select: () =>
        of({ name, id: 'test-user-id', theme: 'light-theme', lastRoute: '/' }),
      getLastRoute: () => '/',
    },
  };
}

function localPermissionProvider(
  opts: {
    canViewAdmin?: boolean;
    canManageProject?: boolean;
  } = {}
) {
  return {
    provide: PermissionService,
    useValue: {
      permissions$: of([]),
      projectPermissions$: of([]),
      load: () => of([]),
      loadProjectPermissions: () => of([]),
      canViewAdiminstration: () => of(opts.canViewAdmin ?? false),
      hasPermission: () => of(false),
      canEditProject: () => of(false),
      canManageProject: () => of(opts.canManageProject ?? false),
      canAdminLockProject: () => of(false),
    },
  };
}

async function renderTopbar(
  overrides: {
    providers?: any[];
    componentProperties?: Partial<TopbarComponent>;
  } = {}
) {
  return renderComponent(TopbarComponent, {
    declarations: [TopbarComponent],
    imports: sharedImports,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: overrides.providers ?? [],
    componentProperties: overrides.componentProperties as any,
  });
}

/**
 * Opens the Material menu via the MatMenuTrigger directive and waits
 * for the overlay panel to appear in the DOM.  Returns the overlay
 * element for content assertions.
 */
async function openMenu(fixture: any): Promise<HTMLElement> {
  const triggerDebug = fixture.debugElement.query(By.directive(MatMenuTrigger));
  expect(triggerDebug).toBeTruthy();
  const trigger = triggerDebug.injector.get(MatMenuTrigger);
  trigger.openMenu();
  fixture.detectChanges();
  await fixture.whenStable();

  // Give the overlay time to render (real browsers need more than a microtask)
  await new Promise<void>((r) => setTimeout(r, 50));
  fixture.detectChanges();
  await fixture.whenStable();

  const overlay = document.querySelector(
    '.cdk-overlay-container'
  ) as HTMLElement;
  return overlay;
}

describe('TopbarComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderTopbar();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display title text', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Test User')],
      componentProperties: {
        title: 'My Custom Title',
        topbarView: TopbarView.CASTER_HOME,
      },
    });

    const el = fixture.nativeElement as HTMLElement;
    const viewText = el.querySelector('.view-text');
    expect(viewText?.textContent).toContain('My Custom Title');
  });

  it('should display user name', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Jane Doe')],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Jane Doe');
  });

  it('should show Administration link with view admin permission', async () => {
    const { fixture } = await renderTopbar({
      providers: [
        userProvider('Admin User'),
        localPermissionProvider({ canViewAdmin: true }),
      ],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).toContain('Administration');
  });

  it('should hide Administration link without permission', async () => {
    const { fixture } = await renderTopbar({
      providers: [
        userProvider('Regular User'),
        localPermissionProvider({ canViewAdmin: false }),
      ],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).not.toContain('Administration');
  });

  it('should show Dark Theme toggle in menu', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Theme User')],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).toContain('Dark Theme');
  });

  it('should show Logout button in menu', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Test User')],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).toContain('Logout');
  });

  it('should call logout when Logout clicked', async () => {
    const logoutSpy = vi.fn();

    const { fixture } = await renderTopbar({
      providers: [
        userProvider('Test User'),
        {
          provide: ComnAuthService,
          useValue: {
            isAuthenticated$: of(true),
            user$: of({}),
            logout: logoutSpy,
            setUserTheme: () => {},
          },
        },
      ],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    const buttons = overlay?.querySelectorAll('button') ?? [];
    let logoutBtn: HTMLElement | null = null;
    buttons.forEach((btn) => {
      if (btn.textContent?.includes('Logout')) {
        logoutBtn = btn;
      }
    });
    expect(logoutBtn).toBeTruthy();
    logoutBtn!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    fixture.detectChanges();

    expect(logoutSpy).toHaveBeenCalledOnce();
  });

  it('should show Exit Administration in admin view with permission', async () => {
    const { fixture } = await renderTopbar({
      providers: [
        userProvider('Admin User'),
        localPermissionProvider({ canViewAdmin: true }),
      ],
      componentProperties: {
        topbarView: TopbarView.CASTER_ADMIN,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).toContain('Exit Administration');
  });

  it('should show Manage Project with projectId and canManageProject', async () => {
    const { fixture } = await renderTopbar({
      providers: [
        userProvider('PM User'),
        localPermissionProvider({ canManageProject: true }),
      ],
      componentProperties: {
        topbarView: TopbarView.CASTER_PROJECT,
        projectId: 'proj-123',
      },
    });
    // Trigger ngOnChanges so canManageProject$ is set
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).toContain('Manage Project');
  });

  it('should hide Manage Project without projectId', async () => {
    const { fixture } = await renderTopbar({
      providers: [
        userProvider('PM User'),
        localPermissionProvider({ canManageProject: true }),
      ],
      componentProperties: {
        topbarView: TopbarView.CASTER_PROJECT,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).not.toContain('Manage Project');
  });

  it('should hide Manage Project without canManageProject permission', async () => {
    const { fixture } = await renderTopbar({
      providers: [
        userProvider('Regular User'),
        localPermissionProvider({ canManageProject: false }),
      ],
      componentProperties: {
        topbarView: TopbarView.CASTER_PROJECT,
        projectId: 'proj-123',
      },
    });
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = await openMenu(fixture);
    expect(overlay?.textContent).not.toContain('Manage Project');
  });

  it('should apply custom topbar color', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Test User')],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
        topbarColor: '#FF0000',
        topbarTextColor: '#00FF00',
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const toolbar = fixture.nativeElement.querySelector(
      'mat-toolbar'
    ) as HTMLElement;
    expect(toolbar).toBeTruthy();
    expect(toolbar.style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(toolbar.style.color).toBe('rgb(0, 255, 0)');
  });

  it('should show sidebar toggle button when sidenav is provided and opened', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Test User')],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
        sidenav: { opened: true },
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const closeBtn = el.querySelector('button[matTooltip="Close Sidebar"]');
    const openBtn = el.querySelector('button[matTooltip="Open Sidebar"]');
    expect(closeBtn).toBeTruthy();
    expect(openBtn).toBeFalsy();
  });

  it('should show Open Sidebar button when sidenav is closed', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Test User')],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
        sidenav: { opened: false },
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const openBtn = el.querySelector('button[matTooltip="Open Sidebar"]');
    const closeBtn = el.querySelector('button[matTooltip="Close Sidebar"]');
    expect(openBtn).toBeTruthy();
    expect(closeBtn).toBeFalsy();
  });

  it('should not show sidebar toggle when no sidenav provided', async () => {
    const { fixture } = await renderTopbar({
      providers: [userProvider('Test User')],
      componentProperties: {
        topbarView: TopbarView.CASTER_HOME,
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const closeBtn = el.querySelector('button[matTooltip="Close Sidebar"]');
    const openBtn = el.querySelector('button[matTooltip="Open Sidebar"]');
    expect(closeBtn).toBeFalsy();
    expect(openBtn).toBeFalsy();
  });

  // Permission tests for canViewAdiminstration controlling admin sidebar visibility
  describe('View* permissions for admin sidebar visibility', () => {
    const viewPermissions = [
      SystemPermission.ViewProjects,
      SystemPermission.ViewUsers,
      SystemPermission.ViewWorkspaces,
      SystemPermission.ViewVlans,
      SystemPermission.ViewRoles,
      SystemPermission.ViewGroups,
      SystemPermission.ViewModules,
      SystemPermission.ViewHosts,
    ];

    viewPermissions.forEach((perm) => {
      it(`should show Administration link when user has ${perm}`, async () => {
        const { fixture } = await renderTopbar({
          providers: [userProvider('Admin User'), permissionProvider([perm])],
          componentProperties: {
            topbarView: TopbarView.CASTER_HOME,
          },
        });
        fixture.detectChanges();
        await fixture.whenStable();

        const overlay = await openMenu(fixture);
        expect(overlay?.textContent).toContain('Administration');
      });
    });

    it('should not show Administration when user has no View* permissions', async () => {
      const { fixture } = await renderTopbar({
        providers: [
          userProvider('Regular User'),
          permissionProvider([SystemPermission.CreateProjects]),
        ],
        componentProperties: {
          topbarView: TopbarView.CASTER_HOME,
        },
      });
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = await openMenu(fixture);
      expect(overlay?.textContent).not.toContain('Administration');
    });
  });

  describe('ManageProjects shows management options', () => {
    it('should show Manage Project with ManageProjects system permission and projectId', async () => {
      const { fixture } = await renderTopbar({
        providers: [
          userProvider('Manager'),
          permissionProvider([SystemPermission.ManageProjects]),
        ],
        componentProperties: {
          topbarView: TopbarView.CASTER_PROJECT,
          projectId: 'proj-456',
        },
      });
      fixture.componentInstance.ngOnChanges();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = await openMenu(fixture);
      expect(overlay?.textContent).toContain('Manage Project');
    });

    it('should show Manage Project with project-level ManageProject permission', async () => {
      const projectId = 'proj-789';
      const claims: ProjectPermissionsClaim[] = [
        {
          projectId,
          permissions: [ProjectPermission.ManageProject],
        },
      ];
      const { fixture } = await renderTopbar({
        providers: [
          userProvider('Project Manager'),
          permissionProvider([], claims),
        ],
        componentProperties: {
          topbarView: TopbarView.CASTER_PROJECT,
          projectId,
        },
      });
      fixture.componentInstance.ngOnChanges();
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = await openMenu(fixture);
      expect(overlay?.textContent).toContain('Manage Project');
    });
  });
});
