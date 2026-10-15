// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  provideEnvironmentInitializer,
  Type,
} from '@angular/core';
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

async function renderProjectTab(grants: PermissionGrants, tab: Tab | Tab[]) {
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
    openTabs: [tab].flat(),
    selectedTab: 0,
  };
  const view = await renderComponent(ProjectTabComponent, {
    declarations: [EditorStub, WorkspaceContainerStub, DesignStub],
    imports: [MatTabsModule, MatButtonModule, MatIconModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ModulesService, useValue: modulesApi },
      { provide: FilesService, useValue: filesApi },
      // The stores hold the open tabs and their entities before the component is
      // built, as when the project page renders it.
      provideEnvironmentInitializer(() => {
        inject(FileStore).set([
          {
            id: 'f1',
            name: 'main.tf',
            directoryId: 'dir1',
            content: 'x',
            editorContent: 'x',
          },
        ]);
        inject(WorkspaceStore).set([
          { id: 'w1', name: 'dev', directoryId: 'dir1', runs: [] },
        ]);
        inject(DesignStore).set([
          { id: 'd1', name: 'Net', directoryId: 'dir1' },
        ]);
        const projects = inject(ProjectStore);
        projects.set([project]);
        projects.setActive('p1');
        projects.ui.upsert('p1', projectUI);
      }),
    ],
    inputs: { project, projectUI },
  });
  await view.fixture.whenStable();
  view.fixture.detectChanges();
  const stub = <T>(type: Type<T>): T =>
    view.fixture.debugElement.query(By.directive(type))?.componentInstance;
  return { ...view, stub, filesApi, projectUI };
}

const file = tabOf(ProjectObjectType.FILE, 'f1', 'main.tf');
const workspace = tabOf(ProjectObjectType.WORKSPACE, 'w1', 'dev');
const design = tabOf(ProjectObjectType.DESIGN, 'd1', 'Net');
const viewer = {
  projects: [{ projectId: 'p1', permissions: [ProjectPermission.ViewProject] }],
};

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
   * Verifies: a file tab passes each project gate to the editor from its own system permission alone: EditProjects to canEdit, LockFiles to canAdminLock, ManageProjects to canManage; each row is a near miss for the other two gates.
   * Interacts with: PermissionService.canEditProject, canAdminLockProject and canManageProject (real), the editor stub's inputs.
   * Data: open file tab main.tf in project p1; one system permission per row, no project claim.
   */
  it.each([
    {
      permission: SystemPermission.EditProjects,
      gates: { canEdit: true, canAdminLock: false, canManage: false },
    },
    {
      permission: SystemPermission.LockFiles,
      gates: { canEdit: false, canAdminLock: true, canManage: false },
    },
    {
      permission: SystemPermission.ManageProjects,
      gates: { canEdit: false, canAdminLock: false, canManage: true },
    },
  ])(
    'maps the $permission system permission to the editor gates',
    async ({ permission, gates }) => {
      const { stub } = await renderProjectTab({ system: [permission] }, file);

      const editor = stub(EditorStub);
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

  /**
   * Verifies: renaming the entity of an open tab, the selected one or another, updates that tab's label.
   * Interacts with: the real FileStore, WorkspaceStore and DesignStore, the tab label's close button.
   * Data: open tabs main.tf (selected), dev and Net; one entity renamed per row; ViewProject on p1.
   */
  it.each([
    {
      kind: 'selected file',
      before: 'main.tf',
      after: 'app.tf',
      rename: () => TestBed.inject(FileStore).update('f1', { name: 'app.tf' }),
    },
    {
      kind: 'workspace',
      before: 'dev',
      after: 'prod',
      rename: () =>
        TestBed.inject(WorkspaceStore).update('w1', { name: 'prod' }),
    },
    {
      kind: 'design',
      before: 'Net',
      after: 'Lan',
      rename: () => TestBed.inject(DesignStore).update('d1', { name: 'Lan' }),
    },
  ])(
    'relabels the $kind tab after a rename',
    async ({ before, after, rename }) => {
      const { fixture } = await renderProjectTab(viewer, [
        file,
        workspace,
        design,
      ]);
      expect(
        screen.getByRole('button', { name: `Close ${before}` }),
      ).toBeInTheDocument();

      rename();
      fixture.detectChanges();

      expect(
        screen.getByRole('button', { name: `Close ${after}` }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: `Close ${before}` }),
      ).not.toBeInTheDocument();
    },
  );

  /**
   * Verifies: a tab opened after the first render, which reaches the store before the projectUI input, still follows renames of its entity.
   * Interacts with: ngOnChanges on projectUI, the real ProjectStore and DesignStore, the tab label's close button.
   * Data: open tab main.tf; design tab Net opened in the store, then in the input; Net renamed to Lan; ViewProject on p1.
   */
  it('relabels a tab opened after the first render', async () => {
    const { fixture, projectUI } = await renderProjectTab(viewer, file);

    const opened: ProjectUI = { ...projectUI, openTabs: [file, design] };
    TestBed.inject(ProjectStore).ui.upsert('p1', opened);
    fixture.componentRef.setInput('projectUI', opened);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      screen.getByRole('button', { name: 'Close Net' }),
    ).toBeInTheDocument();

    TestBed.inject(DesignStore).update('d1', { name: 'Lan' });
    fixture.detectChanges();

    expect(
      screen.getByRole('button', { name: 'Close Lan' }),
    ).toBeInTheDocument();
  });
});
