// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ComnAuthService } from '@cmusei/crucible-common';
import { ResizableModule } from 'angular-resizable-element';
import { User as OidcUser } from 'oidc-client-ts';
import {
  Project,
  ProjectPermissionsClaim,
  ProjectPermissionsService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { TopbarView } from 'src/app/shared/components/top-bar/topbar.models';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectStore } from '../../../state/project-store.service';
import { ProjectUI } from '../../../state/project.model';
import { ProjectCollapseContainerComponent } from './project-collapse-container.component';
import { ProjectComponent } from 'src/app/project/component/project-details/project/project.component';
import { ProjectNavigationContainerComponent } from 'src/app/project/component/project-details/project-navigation-container/project-navigation-container.component';
import { TopbarComponent } from 'src/app/shared/components/top-bar/topbar.component';
import { InventoryPanelComponent } from 'src/app/inventory/components/inventory-panel/inventory-panel.component';

@Component({
  selector: 'cas-project-navigation',
  template: '',
})
class ProjectNavigationStub {}

@Component({ selector: 'cas-topbar', template: '' })
class TopbarStub {
  readonly title = input<string>(undefined);
  readonly topbarView = input<TopbarView>(undefined);
  readonly sidenav = input<unknown>(undefined);
  readonly projectId = input<string>(undefined);
  readonly sidenavToggle = output<boolean>();
  readonly editMemberships = output<void>();
}

@Component({ selector: 'cas-project', template: '' })
class ProjectStub {
  readonly loading = input<boolean>(undefined);
  readonly project = input<Project>(undefined);
  readonly projectUI = input<ProjectUI>(undefined);
  readonly closeTab = output<string>();
  readonly tabChanged = output<unknown>();
}

@Component({ selector: 'cas-inventory-panel', template: '' })
class InventoryPanelStub {}

/**
 * Renders the project page with project p1 Range already active, over the
 * REAL PermissionService primed with the given system permissions.
 */
async function renderContainer(system: SystemPermission[] = []) {
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinProject: vi.fn(),
    leaveProject: vi.fn(),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'joinProject' | 'leaveProject'
  >;
  const projectPermissionsApi = {
    getMyProjectPermissions: vi.fn((_projectId?: string) =>
      of<ProjectPermissionsClaim[]>([]),
    ),
  } satisfies ApiStub<ProjectPermissionsService>;
  const auth = {
    user$: of(
      new OidcUser({
        access_token: '',
        token_type: 'Bearer',
        profile: { sub: 'u1', name: 'Ada', iss: '', aud: '', exp: 0, iat: 0 },
      }),
    ),
  } satisfies Pick<ComnAuthService, 'user$'>;
  const { fixture } = await renderComponent(ProjectCollapseContainerComponent, {
    childStubs: [
      {
        replace: ProjectNavigationContainerComponent,
        with: ProjectNavigationStub,
      },
      { replace: TopbarComponent, with: TopbarStub },
      { replace: ProjectComponent, with: ProjectStub },
      { replace: InventoryPanelComponent, with: InventoryPanelStub },
    ],
    imports: [
      MatSidenavModule,
      MatToolbarModule,
      MatIconModule,
      MatDividerModule,
      ResizableModule,
    ],
    providers: [
      ...permissionDataProviders({ system }),
      { provide: SignalRService, useValue: signalR },
      {
        provide: ProjectPermissionsService,
        useValue: projectPermissionsApi,
      },
      { provide: ComnAuthService, useValue: auth },
    ],
    // The project is active before the page opens, as after the project
    // route resolves.
    configureTestBed: (testBed) => {
      const store = testBed.inject(ProjectStore);
      store.set([{ id: 'p1', name: 'Range' }]);
      store.setActive('p1');
      store.ui.setActive('p1');
    },
  });
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, signalR, projectPermissionsApi };
}

describe('ProjectCollapseContainerComponent', () => {
  /**
   * Verifies: once a project is active the page joins its hub group, loads its permission claims, and shows the project in the top bar and the project view.
   * Interacts with: real ProjectStore and ProjectQuery, SignalRService.joinProject (stub), ProjectPermissionsService.getMyProjectPermissions (stub), ComnAuthService.user$ (stub).
   * Data: active project p1 Range.
   */
  it('shows the active project', async () => {
    const { fixture, signalR, projectPermissionsApi } = await renderContainer();

    expect(signalR.joinProject).toHaveBeenCalledWith('p1');
    expect(projectPermissionsApi.getMyProjectPermissions).toHaveBeenCalledWith(
      'p1',
    );
    const topbar: TopbarStub = fixture.debugElement.query(
      By.directive(TopbarStub),
    ).componentInstance;
    expect(topbar.title()).toBe('Range');
    expect(topbar.projectId()).toBe('p1');
    const project: ProjectStub = fixture.debugElement.query(
      By.directive(ProjectStub),
    ).componentInstance;
    expect(project.project().id).toBe('p1');
    expect(screen.getByRole('heading', { name: 'Caster' })).toBeInTheDocument();
  });

  /**
   * Verifies: with ViewHosts the side panel shows the Infrastructure panel.
   * Interacts with: PermissionService.hasPermission (real) over stubbed system permissions.
   * Data: active project p1 Range; system permission ViewHosts.
   */
  it('shows the Infrastructure panel with ViewHosts', async () => {
    const { fixture } = await renderContainer([SystemPermission.ViewHosts]);

    expect(
      fixture.debugElement.query(By.directive(InventoryPanelStub)),
    ).not.toBeNull();
  });

  /**
   * Verifies: without ViewHosts the Infrastructure panel is not rendered, so it can never fetch the inventory.
   * Interacts with: PermissionService.hasPermission (real) over stubbed system permissions.
   * Data: active project p1 Range; ViewProjects but not ViewHosts.
   */
  it('hides the Infrastructure panel without ViewHosts', async () => {
    const { fixture } = await renderContainer([SystemPermission.ViewProjects]);

    expect(
      fixture.debugElement.query(By.directive(InventoryPanelStub)),
    ).toBeNull();
    expect(
      fixture.debugElement.query(By.directive(ProjectStub)),
    ).not.toBeNull();
  });
});
