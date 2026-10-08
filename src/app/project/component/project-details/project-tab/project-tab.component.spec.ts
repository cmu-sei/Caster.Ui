// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { DesignStore } from 'src/app/designs/state/design.store';
import { FileStore } from 'src/app/files/state/file.store';
import {
  FilesService,
  ModelFile,
  Module,
  ModulesService,
  Project,
  ProjectPermission,
  SystemPermission,
} from 'src/app/generated/caster-api';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { WorkspaceStore } from 'src/app/workspace/state/workspace.store';
import {
  ProjectStore,
  initialProjectUIState,
} from '../../../state/project-store.service';
import {
  ProjectObjectType,
  ProjectUI,
  Tab,
} from '../../../state/project.model';
import { ProjectTabComponent } from './project-tab.component';

@Component({ selector: 'cas-editor', template: '', standalone: false })
class EditorStub {
  @Input() fileId: string;
  @Input() modules: Module[];
  @Input() sidebarOpen: boolean;
  @Input() sidebarView: string;
  @Input() sidenavWidth: number;
  @Input() breadcrumb: unknown;
  @Input() canEdit: boolean;
  @Input() canAdminLock: boolean;
  @Input() canManage: boolean;
  @Output() sidebarChanged = new EventEmitter<boolean>();
  @Output() sidebarViewChanged = new EventEmitter<string>();
  @Output() sidenavWidthChanged = new EventEmitter<number>();
}

@Component({
  selector: 'cas-workspace-container',
  template: '',
  standalone: false,
})
class WorkspaceContainerStub {
  @Input() workspaceId: string;
  @Input() breadcrumb: unknown;
  @Input() canEdit: boolean;
}

@Component({ selector: 'cas-design', template: '', standalone: false })
class DesignStub {
  @Input() designId: string;
  @Input() canEdit: boolean;
}

const project: Project = { id: 'p1', name: 'Range' };

function tabOf(type: ProjectObjectType, id: string, name: string): Tab {
  return { id, name, type, directoryId: 'dir1', breadcrumb: [] };
}

async function renderProjectTab(grants: PermissionGrants, tab: Tab) {
  const modulesApi = {
    getAllModules: vi.fn(() => of<Module[]>([])),
  } satisfies ApiStub<ModulesService>;
  // iif() takes loadFile() as an argument, so getFile builds its request even
  // for a file whose content is already loaded; it is never subscribed then.
  const filesApi = {
    getFile: vi.fn((id: string) => of<ModelFile>({ id })),
  } satisfies ApiStub<FilesService>;
  const projectUI: ProjectUI = {
    ...initialProjectUIState,
    id: 'p1',
    openTabs: [tab],
    selectedTab: 0,
  };
  const view = await renderComponent(ProjectTabComponent, {
    declarations: [EditorStub, WorkspaceContainerStub, DesignStub],
    imports: [MatTabsModule, MatButtonModule, MatIconModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ModulesService, useValue: modulesApi },
      { provide: FilesService, useValue: filesApi },
    ],
    inputs: { project, projectUI },
  });
  TestBed.inject(FileStore).set([
    {
      id: 'f1',
      name: 'main.tf',
      directoryId: 'dir1',
      content: 'x',
      editorContent: 'x',
    },
  ]);
  TestBed.inject(WorkspaceStore).set([
    { id: 'w1', name: 'dev', directoryId: 'dir1', runs: [] },
  ]);
  TestBed.inject(DesignStore).set([
    { id: 'd1', name: 'Net', directoryId: 'dir1' },
  ]);
  const projects = TestBed.inject(ProjectStore);
  projects.set([project]);
  projects.setActive('p1');
  projects.ui.upsert('p1', projectUI);
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  const stub = <T>(type: Type<T>): T =>
    view.fixture.debugElement.query(By.directive(type))?.componentInstance;
  return { ...view, stub, filesApi };
}

const file = tabOf(ProjectObjectType.FILE, 'f1', 'main.tf');

describe('ProjectTabComponent', () => {
  /**
   * Verifies: a file tab passes each project gate to the editor from its own claim: EditProject to canEdit, LockFiles to canAdminLock, ManageProject to canManage.
   * Interacts with: PermissionService.canEditProject, canAdminLockProject and canManageProject (real), the editor stub's inputs.
   * Data: open file tab main.tf in project p1; one project claim per row.
   */
  it.each([
    {
      permission: ProjectPermission.EditProject,
      gates: { canEdit: true, canAdminLock: false, canManage: false },
    },
    {
      permission: ProjectPermission.LockFiles,
      gates: { canEdit: false, canAdminLock: true, canManage: false },
    },
    {
      permission: ProjectPermission.ManageProject,
      gates: { canEdit: false, canAdminLock: false, canManage: true },
    },
  ])(
    'maps a $permission claim to the editor gates',
    async ({ permission, gates }) => {
      const { stub } = await renderProjectTab(
        { projects: [{ projectId: 'p1', permissions: [permission] }] },
        file,
      );

      const editor = stub(EditorStub);
      expect(editor.fileId).toBe('f1');
      expect({
        canEdit: editor.canEdit,
        canAdminLock: editor.canAdminLock,
        canManage: editor.canManage,
      }).toEqual(gates);
    },
  );

  /**
   * Verifies: the matching system permissions grant the editor gates without a project claim.
   * Interacts with: PermissionService (real), the editor stub's inputs.
   * Data: system permissions EditProjects, LockFiles and ManageProjects.
   */
  it('passes every editor gate with the system permissions', async () => {
    const { stub } = await renderProjectTab(
      {
        system: [
          SystemPermission.EditProjects,
          SystemPermission.LockFiles,
          SystemPermission.ManageProjects,
        ],
      },
      file,
    );

    const editor = stub(EditorStub);
    expect(editor.canEdit).toBe(true);
    expect(editor.canAdminLock).toBe(true);
    expect(editor.canManage).toBe(true);
  });

  /**
   * Verifies: a viewer of this project, or a holder of every claim on another project, gets no editor gate.
   * Interacts with: PermissionService (real), the editor stub's inputs.
   * Data: near misses: ViewProject on p1, and EditProject, LockFiles and ManageProject on p9.
   */
  it('passes false for every editor gate to a viewer', async () => {
    const { stub } = await renderProjectTab(
      {
        projects: [
          { projectId: 'p1', permissions: [ProjectPermission.ViewProject] },
          {
            projectId: 'p9',
            permissions: [
              ProjectPermission.EditProject,
              ProjectPermission.LockFiles,
              ProjectPermission.ManageProject,
            ],
          },
        ],
      },
      file,
    );

    const editor = stub(EditorStub);
    expect(editor.canEdit).toBe(false);
    expect(editor.canAdminLock).toBe(false);
    expect(editor.canManage).toBe(false);
  });

  /**
   * Verifies: workspace and design tabs pass canEdit true with an EditProject claim and false with only ViewProject.
   * Interacts with: PermissionService.canEditProject (real), the workspace-container and design stubs' canEdit inputs.
   * Data: open workspace tab dev or design tab Net; EditProject, then (near miss) ViewProject on p1.
   */
  it.each([
    {
      kind: 'workspace',
      tab: tabOf(ProjectObjectType.WORKSPACE, 'w1', 'dev'),
      permission: ProjectPermission.EditProject,
      canEdit: true,
    },
    {
      kind: 'workspace',
      tab: tabOf(ProjectObjectType.WORKSPACE, 'w1', 'dev'),
      permission: ProjectPermission.ViewProject,
      canEdit: false,
    },
    {
      kind: 'design',
      tab: tabOf(ProjectObjectType.DESIGN, 'd1', 'Net'),
      permission: ProjectPermission.EditProject,
      canEdit: true,
    },
    {
      kind: 'design',
      tab: tabOf(ProjectObjectType.DESIGN, 'd1', 'Net'),
      permission: ProjectPermission.ViewProject,
      canEdit: false,
    },
  ])(
    'passes canEdit $canEdit to a $kind tab for a $permission claim',
    async ({ kind, tab, permission, canEdit }) => {
      const { stub } = await renderProjectTab(
        { projects: [{ projectId: 'p1', permissions: [permission] }] },
        tab,
      );

      const child =
        kind === 'workspace' ? stub(WorkspaceContainerStub) : stub(DesignStub);
      expect(child.canEdit).toBe(canEdit);
    },
  );

  /**
   * Verifies: with no open tab the project shows the open-a-file message.
   * Interacts with: the showTabs flag.
   * Data: no grants; the project UI has no open tabs.
   */
  it('asks to open a file when no tab is open', async () => {
    await renderComponent(ProjectTabComponent, {
      declarations: [EditorStub, WorkspaceContainerStub, DesignStub],
      imports: [MatTabsModule],
      providers: [
        ...permissionDataProviders({}),
        {
          provide: ModulesService,
          useValue: {
            getAllModules: vi.fn(() => of<Module[]>([])),
          } satisfies ApiStub<ModulesService>,
        },
      ],
      inputs: { project, projectUI: { ...initialProjectUIState, id: 'p1' } },
    });

    expect(
      screen.getByText('Please open a file or workspace'),
    ).toBeInTheDocument();
  });
});
