// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { ProjectTabComponent } from './project-tab.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import {
  SystemPermission,
  ProjectPermission,
  ProjectPermissionsClaim,
} from 'src/app/generated/caster-api';
import { ProjectObjectType } from '../../../state';
import { DesignQuery } from 'src/app/designs/state/design.query';
import { of } from 'rxjs';

const sharedImports = [
  CommonModule,
  MatTabsModule,
  MatIconModule,
  MatDialogModule,
  MatButtonModule,
];

const mockProject = { id: 'p-1', name: 'Test Project' } as any;
const mockProjectUI = {
  openTabs: [],
  selectedTab: -1,
} as any;

const mockProjectUIWithTabs = {
  openTabs: [
    {
      id: 'f-1',
      name: 'main.tf',
      type: ProjectObjectType.FILE,
      breadcrumb: [],
    },
  ],
  selectedTab: 0,
} as any;

async function renderProjectTab(
  overrides: {
    project?: any;
    projectUI?: any;
    providers?: any[];
  } = {}
) {
  return renderComponent(ProjectTabComponent, {
    declarations: [ProjectTabComponent],
    imports: sharedImports,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    providers: [
      {
        provide: DesignQuery,
        useValue: {
          selectAll: () => of([]),
          selectEntity: () => of(null),
          getEntity: () => null,
        },
      },
      ...(overrides.providers ?? []),
    ],
    componentProperties: {
      project: overrides.project ?? mockProject,
      projectUI: overrides.projectUI ?? mockProjectUI,
    },
  });
}

describe('ProjectTabComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderProjectTab();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show placeholder message when no tabs are open', async () => {
    await renderProjectTab();
    expect(
      screen.getByText('Please open a file or workspace')
    ).toBeInTheDocument();
  });

  it('should set canEdit$ with EditProjects system permission', async () => {
    const { fixture } = await renderProjectTab({
      providers: [permissionProvider([SystemPermission.EditProjects])],
    });

    let canEdit: boolean;
    fixture.componentInstance.canEdit$.subscribe((v) => (canEdit = v));
    expect(canEdit).toBe(true);
  });

  it('should set canEdit$ to false without EditProjects permission', async () => {
    const { fixture } = await renderProjectTab({
      providers: [permissionProvider([])],
    });

    let canEdit: boolean;
    fixture.componentInstance.canEdit$.subscribe((v) => (canEdit = v));
    expect(canEdit).toBe(false);
  });

  it('should set canEdit$ with project-level EditProject permission', async () => {
    const claim: ProjectPermissionsClaim = {
      projectId: 'p-1',
      permissions: [ProjectPermission.EditProject],
    };
    const { fixture } = await renderProjectTab({
      providers: [permissionProvider([], [claim])],
    });

    let canEdit: boolean;
    fixture.componentInstance.canEdit$.subscribe((v) => (canEdit = v));
    expect(canEdit).toBe(true);
  });

  it('should set canAdminLock$ with LockFiles system permission', async () => {
    const { fixture } = await renderProjectTab({
      providers: [permissionProvider([SystemPermission.LockFiles])],
    });

    let canLock: boolean;
    fixture.componentInstance.canAdminLock$.subscribe((v) => (canLock = v));
    expect(canLock).toBe(true);
  });

  it('should set canAdminLock$ to false without LockFiles permission', async () => {
    const { fixture } = await renderProjectTab({
      providers: [permissionProvider([])],
    });

    let canLock: boolean;
    fixture.componentInstance.canAdminLock$.subscribe((v) => (canLock = v));
    expect(canLock).toBe(false);
  });

  it('should set canAdminLock$ with project-level LockFiles permission', async () => {
    const claim: ProjectPermissionsClaim = {
      projectId: 'p-1',
      permissions: [ProjectPermission.LockFiles],
    };
    const { fixture } = await renderProjectTab({
      providers: [permissionProvider([], [claim])],
    });

    let canLock: boolean;
    fixture.componentInstance.canAdminLock$.subscribe((v) => (canLock = v));
    expect(canLock).toBe(true);
  });
});
