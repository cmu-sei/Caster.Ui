// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { ComnAuthQuery, ComnSettingsService } from '@cmusei/crucible-common';
import { CurrentUserQuery, UserService } from 'src/app/users/state';
import { FileQuery } from 'src/app/files/state';
import { ProjectQuery } from 'src/app/project/state/project-query.service';
import { ProjectService } from 'src/app/project/state/project.service';
import { ProjectObjectType } from 'src/app/project/state';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { ProjectCollapseContainerComponent } from './project-collapse-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderContainer() {
  const projectService = {
    closeTab: vi.fn(),
    setSelectedTab: vi.fn(),
    setLeftSidebarWidth: vi.fn(),
    setLeftSidebarOpen: vi.fn(),
  };
  const projectQuery = {
    selectLoading: () => of(false),
    selectActive: () => EMPTY,
    getActive: () => ({ id: 'proj-1' }),
    getLeftSidebarOpen: () => of(true),
    getLeftSidebarWidth: () => of(300),
    ui: { selectActive: () => of({ openTabs: [] }) },
  };
  const userService = { setCurrentUser: vi.fn() };
  const signalRService = {
    startConnection: vi.fn(() => Promise.resolve()),
    joinProject: vi.fn(),
    leaveProject: vi.fn(),
  };
  const navigate = vi.fn();

  const rendered = await renderComponent(
    ProjectCollapseContainerComponent,
    {
      declarations: [ProjectCollapseContainerComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ProjectService, useValue: projectService },
        { provide: ProjectQuery, useValue: projectQuery },
        { provide: UserService, useValue: userService },
        {
          provide: ComnAuthQuery,
          useValue: { userTheme$: of('light-theme') },
        },
        {
          provide: CurrentUserQuery,
          useValue: { userTheme$: of('light-theme'), select: () => of({}) },
        },
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
        { provide: FileQuery, useValue: { getEntity: () => null } },
        { provide: SignalRService, useValue: signalRService },
        {
          provide: PermissionService,
          useValue: { loadProjectPermissions: () => of([]) },
        },
        { provide: Router, useValue: { navigate } },
      ],
    },
  );

  return {
    ...rendered,
    projectService,
    signalRService,
    userService,
    navigate,
  };
}

describe('ProjectCollapseContainerComponent', () => {
  it('creates and sets the current user', async () => {
    const { fixture, userService } = await renderContainer();
    expect(fixture.componentInstance).toBeTruthy();
    expect(userService.setCurrentUser).toHaveBeenCalled();
  });

  it('closeTab dispatches to ProjectService.closeTab', async () => {
    const { fixture, projectService } = await renderContainer();
    fixture.componentInstance.closeTab('tab-1');
    expect(projectService.closeTab).toHaveBeenCalledWith('tab-1');
  });

  it('tabChangedFn dispatches to ProjectService.setSelectedTab', async () => {
    const { fixture, projectService } = await renderContainer();
    fixture.componentInstance.tabChangedFn({ index: 2, tab: {} });
    expect(projectService.setSelectedTab).toHaveBeenCalledWith(2);
  });

  it('resizingFn enforces the sidebar minimum width', async () => {
    const { fixture } = await renderContainer();
    fixture.componentInstance.resizingFn({ rectangle: { width: 100 } });
    expect(fixture.componentInstance.leftSidebarWidth).toBe(250);
    fixture.componentInstance.resizingFn({ rectangle: { width: 400 } });
    expect(fixture.componentInstance.leftSidebarWidth).toBe(400);
  });

  it('resizeEndFn persists the enforced width', async () => {
    const { fixture, projectService } = await renderContainer();
    fixture.componentInstance.project = { id: 'p1' } as never;
    fixture.componentInstance.resizeEndFn({ rectangle: { width: 400 } });
    expect(projectService.setLeftSidebarWidth).toHaveBeenCalledWith('p1', 400);
  });

  it('leftSidebarOpenFn persists the open state', async () => {
    const { fixture, projectService } = await renderContainer();
    fixture.componentInstance.project = { id: 'p1' } as never;
    fixture.componentInstance.leftSidebarOpenFn(false);
    expect(projectService.setLeftSidebarOpen).toHaveBeenCalledWith('p1', false);
  });

  it('goToHome navigates to /', async () => {
    const { fixture, navigate } = await renderContainer();
    fixture.componentInstance.goToHome();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('canDeactivate returns true when no file tab is dirty', async () => {
    const { fixture } = await renderContainer();
    (fixture.componentInstance as unknown as { projectUI: { openTabs: unknown[] } }).projectUI = {
      openTabs: [{ type: ProjectObjectType.FILE, id: 'f1' }],
    };
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
  });

  it('ngOnDestroy leaves the project signalR channel', async () => {
    const { fixture, signalRService } = await renderContainer();
    fixture.componentInstance.ngOnDestroy();
    expect(signalRService.leaveProject).toHaveBeenCalledWith('proj-1');
  });
});
