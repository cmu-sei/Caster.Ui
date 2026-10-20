// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ComnAuthService } from '@cmusei/crucible-common';
import { User as OidcUser } from 'oidc-client-ts';
import { Project, ProjectsService } from 'src/app/generated/caster-api';
import { TopbarView } from 'src/app/shared/components/top-bar/topbar.models';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
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

describe('ProjectListContainerComponent', () => {
  /**
   * Verifies: the home page loads only the user's projects into the project list and records the signed-in user.
   * Interacts with: ProjectsService.getAllProjects (stub), ComnAuthService.user$ (stub), real ProjectService, UserService and CurrentUserQuery.
   * Data: one project p1; signed-in user Ada (u1).
   */
  it('lists the current user projects', async () => {
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
    } satisfies Pick<ComnAuthService, 'user$' | 'logout'>;
    const { fixture } = await renderComponent(ProjectListContainerComponent, {
      childStubs: [
        { replace: TopbarComponent, with: TopbarStub },
        { replace: ProjectListComponent, with: ProjectListStub },
      ],
      providers: [
        { provide: ProjectsService, useValue: projectsApi },
        { provide: ComnAuthService, useValue: auth },
      ],
    });

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
});
