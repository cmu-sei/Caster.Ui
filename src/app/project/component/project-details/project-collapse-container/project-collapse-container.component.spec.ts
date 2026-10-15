// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
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
} from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { TopbarView } from 'src/app/shared/components/top-bar/topbar.models';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectStore } from '../../../state/project-store.service';
import { ProjectUI } from '../../../state/project.model';
import { ProjectCollapseContainerComponent } from './project-collapse-container.component';

@Component({
  selector: 'cas-project-navigation',
  template: '',
  standalone: false,
})
class ProjectNavigationStub {}

@Component({ selector: 'cas-topbar', template: '', standalone: false })
class TopbarStub {
  @Input() title: string;
  @Input() topbarView: TopbarView;
  @Input() sidenav: unknown;
  @Input() projectId: string;
  @Output() sidenavToggle = new EventEmitter<boolean>();
  @Output() editMemberships = new EventEmitter<void>();
}

@Component({ selector: 'cas-project', template: '', standalone: false })
class ProjectStub {
  @Input() loading: boolean;
  @Input() project: Project;
  @Input() projectUI: ProjectUI;
  @Output() closeTab = new EventEmitter<string>();
  @Output() tabChanged = new EventEmitter<unknown>();
}

describe('ProjectCollapseContainerComponent', () => {
  /**
   * Verifies: once a project is active the page joins its hub group, loads its permission claims, and shows the project in the top bar and the project view.
   * Interacts with: real ProjectStore and ProjectQuery, SignalRService.joinProject (stub), ProjectPermissionsService.getMyProjectPermissions (stub), ComnAuthService.user$ (stub).
   * Data: active project p1 Range.
   */
  it('shows the active project', async () => {
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
    const { fixture } = await renderComponent(
      ProjectCollapseContainerComponent,
      {
        declarations: [ProjectNavigationStub, TopbarStub, ProjectStub],
        imports: [
          MatSidenavModule,
          MatToolbarModule,
          MatIconModule,
          MatDividerModule,
          ResizableModule,
        ],
        providers: [
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
      },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(signalR.joinProject).toHaveBeenCalledWith('p1');
    expect(projectPermissionsApi.getMyProjectPermissions).toHaveBeenCalledWith(
      'p1',
    );
    const topbar: TopbarStub = fixture.debugElement.query(
      By.directive(TopbarStub),
    ).componentInstance;
    expect(topbar.title).toBe('Range');
    expect(topbar.projectId).toBe('p1');
    const project: ProjectStub = fixture.debugElement.query(
      By.directive(ProjectStub),
    ).componentInstance;
    expect(project.project.id).toBe('p1');
    expect(screen.getByRole('heading', { name: 'Caster' })).toBeInTheDocument();
  });
});
