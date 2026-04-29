// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { CurrentUserQuery, UserService } from 'src/app/users/state';
import { ProjectQuery } from 'src/app/project/state/project-query.service';
import { ProjectService } from 'src/app/project/state/project.service';
import { ProjectListContainerComponent } from './project-list-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderContainer() {
  const loadProjects = vi.fn(() => of([]));
  const logout = vi.fn();
  const setCurrentUser = vi.fn();
  const rendered = await renderComponent(ProjectListContainerComponent, {
    declarations: [ProjectListContainerComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: ProjectService, useValue: { loadProjects } },
      {
        provide: ProjectQuery,
        useValue: { selectAll: () => of([]), selectLoading: () => of(false) },
      },
      { provide: ComnAuthService, useValue: { logout } },
      {
        provide: ComnSettingsService,
        useValue: {
          settings: {
            AppTopBarText: 'Caster',
            AppTopBarHexColor: '#000',
            AppTopBarHexTextColor: '#FFF',
          },
        },
      },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: UserService, useValue: { setCurrentUser } },
      {
        provide: CurrentUserQuery,
        useValue: { select: () => of({ name: 'alice' }) },
      },
    ],
  });
  return { ...rendered, loadProjects, logout, setCurrentUser };
}

describe('ProjectListContainerComponent', () => {
  it('creates and loads projects on init', async () => {
    const { fixture, loadProjects, setCurrentUser } = await renderContainer();
    expect(fixture.componentInstance).toBeTruthy();
    expect(loadProjects).toHaveBeenCalledWith(true);
    expect(setCurrentUser).toHaveBeenCalled();
  });

  it('populates the username from CurrentUserQuery', async () => {
    const { fixture } = await renderContainer();
    expect(fixture.componentInstance.username).toBe('alice');
  });

  it('logout dispatches to ComnAuthService.logout', async () => {
    const { fixture, logout } = await renderContainer();
    fixture.componentInstance.logout();
    expect(logout).toHaveBeenCalled();
  });
});
