// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ModuleScopeService } from 'src/app/module-scopes/module-scope.service';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { Subject, of, throwError } from 'rxjs';
import { ACCESS_NOTE } from './project-access-dialog.component';
import {
  AssignmentsService,
  ModuleScope,
  ModuleScopesService,
  ProjectGroupsService,
  ProjectsService,
} from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  ProjectAccessDialogComponent,
  ProjectAccessDialogData,
} from './project-access-dialog.component';

const projects = [
  { id: 'p1', name: 'Range A' },
  { id: 'p2', name: 'Range B' },
];
const groups = [{ id: 'g1', name: 'Cyber' }];

const own: ModuleScope = {
  id: 's1',
  name: 'cmu',
  description: 'Managed from the Modules page',
  paths: ['cmu'],
  projects: [{ projectId: 'p1', name: 'Range A' }],
  projectGroups: [],
};

interface RenderOptions {
  assignFails?: boolean;
  listFails?: boolean;
  /** Re-reading a scope after the assignments are saved fails. */
  rereadFails?: boolean;
}

async function renderDialog(
  data: Partial<ProjectAccessDialogData> = {},
  options: RenderOptions = {},
) {
  const { dialogRef, close } = dialogRefStub<ProjectAccessDialogComponent>();
  const scopesApi = {
    createModuleScope: vi.fn(() =>
      of<ModuleScope>({ id: 's2', name: 'cmu', paths: ['cmu'] }),
    ),
    getModuleScope: vi.fn(() =>
      options.rereadFails
        ? throwError(() => new HttpErrorResponse({ status: 503 }))
        : of<ModuleScope>({ ...own }),
    ),
  };
  const assignmentsApi = {
    editAssignments: vi.fn(() =>
      options.assignFails
        ? throwError(
            () =>
              new HttpErrorResponse({
                status: 400,
                error: { title: 'Project not found' },
              }),
          )
        : of(undefined),
    ),
  };
  const view = await renderComponent(ProjectAccessDialogComponent, {
    imports: [
      ProjectAccessDialogComponent,
      MatTabsModule,
      ...CRUCIBLE_DIALOG_IMPORTS,
    ],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      {
        provide: MAT_DIALOG_DATA,
        useValue: { source: 'cmu', scopes: [], ...data },
      },
      { provide: ModuleScopesService, useValue: scopesApi },
      { provide: AssignmentsService, useValue: assignmentsApi },
      {
        provide: ProjectsService,
        useValue: {
          getAllProjects: vi.fn(() =>
            options.listFails
              ? throwError(() => new Error('down'))
              : of(structuredClone(projects)),
          ),
        },
      },
      {
        provide: ProjectGroupsService,
        useValue: {
          getProjectGroups: vi.fn(() => of(structuredClone(groups))),
        },
      },
    ],
  });
  await view.fixture.whenStable();
  return { ...view, scopesApi, assignmentsApi, close, user: userEvent.setup() };
}

const save = () => screen.getByRole('button', { name: 'Save' });

describe('ProjectAccessDialogComponent', () => {
  /**
   * Verifies: the dialog is about one source: titled with it, with only the Projects and Project Groups tabs, no scope name, description, select or path fields, and no search magnifier.
   * Interacts with: the dialog template.
   * Data: source cmu with no scopes.
   */
  it('shows only who may use the source', async () => {
    const { container } = await renderDialog();

    expect(screen.getByText('Project access: cmu')).toBeInTheDocument();
    expect(
      screen.getAllByRole('tab').map((x) => x.textContent?.trim()),
    ).toEqual(['Projects (0)', 'Project Groups (0)']);
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByLabelText('Description')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'cmu' })).toBeNull();
    expect(container.querySelector('mat-icon[matprefix]')).toBeNull();
  });

  /**
   * Verifies: with no scope of its own, ticking a project and a group makes the scope named as the source, with the managed description and the source as its only path, then sends one assignments request naming the new scope's id, and closes with it.
   * Interacts with: ModuleScopesService.createModuleScope, AssignmentsService.editAssignments (stubs), the dialog ref.
   * Data: source cmu, no scopes; tick Range B and Cyber.
   */
  it('creates the source scope on the first save and assigns it', async () => {
    const { scopesApi, assignmentsApi, close, user } = await renderDialog();

    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(screen.getByRole('tab', { name: /Project Groups/ }));
    await user.click(screen.getByRole('checkbox', { name: /Cyber/ }));
    await user.click(save());

    expect(scopesApi.createModuleScope).toHaveBeenCalledWith({
      name: 'cmu',
      description: 'Managed from the Modules page',
      paths: ['cmu'],
    });
    expect(assignmentsApi.editAssignments).toHaveBeenCalledTimes(1);
    expect(assignmentsApi.editAssignments).toHaveBeenCalledWith({
      changes: [
        { operation: 'Add', projectId: 'p2', moduleScopeId: 's2' },
        { operation: 'Add', projectGroupId: 'g1', moduleScopeId: 's2' },
      ],
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }));
  });

  /**
   * Verifies: with nobody ticked and no scope of its own, saving changes nothing: no scope is made and nothing is sent.
   * Interacts with: ModuleScopesService.createModuleScope, AssignmentsService.editAssignments (stubs).
   * Data: source cmu, no scopes, nothing ticked.
   */
  it('does nothing when nobody is ticked and there is no scope', async () => {
    const { scopesApi, assignmentsApi, close, user } = await renderDialog();

    await user.click(save());

    expect(scopesApi.createModuleScope).not.toHaveBeenCalled();
    expect(assignmentsApi.editAssignments).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  /**
   * Verifies: with a scope that is exactly the source, its assignments are ticked and a save sends only the difference: the project added and the one removed, with no new scope made.
   * Interacts with: AssignmentsService.editAssignments, ModuleScopesService.createModuleScope (stubs).
   * Data: Range A assigned; untick it, tick Range B.
   */
  it('sends only the assignment changes for the existing scope', async () => {
    const { scopesApi, assignmentsApi, user } = await renderDialog({
      scopes: [own],
    });

    expect(screen.getByRole('checkbox', { name: /Range A/ })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /Range A/ }));
    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(save());

    expect(scopesApi.createModuleScope).not.toHaveBeenCalled();
    expect(assignmentsApi.editAssignments).toHaveBeenCalledWith({
      changes: [
        { operation: 'Add', projectId: 'p2', moduleScopeId: 's1' },
        { operation: 'Remove', projectId: 'p1', moduleScopeId: 's1' },
      ],
    });
  });

  /**
   * Verifies: removing the last assignment keeps the scope: only the removal is sent, no scope is deleted or made.
   * Interacts with: AssignmentsService.editAssignments, ModuleScopesService (stubs).
   * Data: Range A assigned; untick it.
   */
  it('keeps the scope when the last assignment is removed', async () => {
    const { scopesApi, assignmentsApi, close, user } = await renderDialog({
      scopes: [own],
    });

    await user.click(screen.getByRole('checkbox', { name: /Range A/ }));
    await user.click(save());

    expect(assignmentsApi.editAssignments).toHaveBeenCalledWith({
      changes: [{ operation: 'Remove', projectId: 'p1', moduleScopeId: 's1' }],
    });
    expect(scopesApi.createModuleScope).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  /**
   * Verifies: a scope that allows the source together with other paths is left alone and listed read-only, naming what it is assigned to and where to edit it; it is not the source's own scope, so a new one is still made.
   * Interacts with: the dialog's note, ModuleScopesService.createModuleScope (stub).
   * Data: a scope with cmu and sei assigned to Range B and Cyber; a scope for sei only that is not listed.
   */
  it('lists a multi-path scope read-only', async () => {
    const multi: ModuleScope = {
      id: 's5',
      name: 'Both',
      paths: ['cmu', 'sei'],
      projects: [{ projectId: 'p2', name: 'Range B' }],
      projectGroups: [{ projectGroupId: 'g1', name: 'Cyber' }],
    };
    const elsewhere: ModuleScope = { ...own, id: 's6', paths: ['sei'] };
    const { scopesApi, user } = await renderDialog({
      scopes: [multi, elsewhere],
    });

    expect(
      screen.getByText(
        'Also allowed through the scope Both, which covers other sources; it cannot be edited on this page: Range B, Cyber.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/scope s6|through the scope cmu/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Range B/ })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: /Range A/ }));
    await user.click(save());
    expect(scopesApi.createModuleScope).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies: when the scope is made but assigning fails, the dialog stays open and says so; saving again reuses that scope (no second one) and retries the same changes.
   * Interacts with: ModuleScopesService.createModuleScope, AssignmentsService.editAssignments (stubs).
   * Data: assignment rejected with "Project not found".
   */
  it('keeps the new scope when assigning fails and retries on it', async () => {
    const { scopesApi, assignmentsApi, close, user } = await renderDialog(
      {},
      { assignFails: true },
    );

    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(save());

    expect(
      await screen.findByText(
        'The access was prepared, but assigning it failed: Project not found',
      ),
    ).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();

    await user.click(save());
    expect(scopesApi.createModuleScope).toHaveBeenCalledTimes(1);
    expect(assignmentsApi.editAssignments).toHaveBeenCalledTimes(2);
    expect(assignmentsApi.editAssignments).toHaveBeenLastCalledWith({
      changes: [{ operation: 'Add', projectId: 'p2', moduleScopeId: 's2' }],
    });
  });

  /**
   * Verifies: the dialog opens with a plain note: added projects and groups can use this source and every shared one, a project with no sources assigned can use every source (or only shared ones if the deployment restricts them), and adding a project limits it to the sources assigned to it.
   * Interacts with: the dialog template.
   * Data: source cmu with no scopes.
   */
  it('says plainly that adding a project limits it to its assigned sources', async () => {
    await renderDialog();

    expect(
      screen.getByText(
        'Projects and groups you add can use this source and every shared source. A project with no sources assigned can use every source (or only shared sources if the deployment restricts them). Adding a project here limits it to the sources assigned to it.',
      ),
    ).toBeInTheDocument();
    expect(ACCESS_NOTE).toContain('limits it to the sources assigned to it');
  });

  /**
   * Verifies: when the assignments are saved but re-reading the scope fails, the dialog does not say assigning failed: a snack bar says the change was saved but the list could not be refreshed, the dialog closes, and the saved selection is the baseline, so another save would send nothing.
   * Interacts with: ModuleScopesService.getModuleScope (rejects), AssignmentsService.editAssignments (stub), MatSnackBar (real).
   * Data: new scope s2; tick Range B; the re-read fails with 503.
   */
  it('reports a failed re-read apart from the saved change', async () => {
    const { fixture, assignmentsApi, close, user } = await renderDialog(
      {},
      { rereadFails: true },
    );

    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(save());

    expect(assignmentsApi.editAssignments).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/assigning it failed/)).toBeNull();
    expect(
      document.querySelector('.mat-mdc-snack-bar-container')?.textContent,
    ).toContain('The change was saved, but the list could not be refreshed');
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }));
    expect(fixture.componentInstance.initialProjects()).toEqual(['p2']);
    // The cache holds what was saved, so the column and a reopened dialog start from it.
    const cached = TestBed.inject(ModuleScopeService)
      .currentScopes()
      .find((x) => x.id === 's2');
    expect(cached?.projects).toEqual([{ projectId: 'p2', name: 'Range B' }]);
    expect(cached?.projectGroups).toEqual([]);
  });

  /**
   * Verifies: the cache written after a failed re-read holds what the save committed, not the selection as it is when the response arrives: unticking the project while the request is in flight does not erase it.
   * Interacts with: AssignmentsService.editAssignments (Subject stub), ModuleScopesService.getModuleScope (rejects), ModuleScopeService.
   * Data: tick Range B, save, untick Range B while pending, then the save succeeds and the re-read fails.
   */
  it('caches the committed selection, not a selection changed while saving', async () => {
    const pending = new Subject<undefined>();
    const { assignmentsApi, user } = await renderDialog(
      {},
      { rereadFails: true },
    );
    assignmentsApi.editAssignments.mockImplementation(() => pending);

    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    await user.click(save());
    await user.click(screen.getByRole('checkbox', { name: /Range B/ }));
    pending.next(undefined);
    pending.complete();
    await Promise.resolve();

    const cached = TestBed.inject(ModuleScopeService)
      .currentScopes()
      .find((x) => x.id === 's2');
    expect(cached?.projects).toEqual([{ projectId: 'p2', name: 'Range B' }]);
  });

  /**
   * Verifies: a scope that allows the source only through a parent path (cmu for cmu/lab) is listed read-only as covering other sources, while a second scope whose only path is the source is listed without that claim.
   * Interacts with: the dialog's note lines.
   * Data: source cmu/lab; scopes for cmu (Range B), cmu/lab twice (one is the managed one named cmu/lab).
   */
  it('words a parent-path scope and a same-path scope differently', async () => {
    const parent: ModuleScope = {
      id: 's7',
      name: 'Parent',
      paths: ['cmu'],
      projects: [{ projectId: 'p2', name: 'Range B' }],
      projectGroups: [],
    };
    const twin: ModuleScope = {
      id: 's8',
      name: 'Twin',
      paths: ['cmu/lab'],
      projects: [],
      projectGroups: [{ projectGroupId: 'g1', name: 'Cyber' }],
    };
    const managed: ModuleScope = {
      ...own,
      id: 's9',
      name: 'cmu/lab',
      paths: ['cmu/lab'],
    };
    await renderDialog({ source: 'cmu/lab', scopes: [parent, twin, managed] });

    expect(
      screen.getByText(
        'Also allowed through the scope Parent, which covers other sources; it cannot be edited on this page: Range B.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Also allowed through the scope Twin, which this page does not edit: Cyber.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/through the scope cmu\/lab/)).toBeNull();
  });

  /**
   * Verifies: a scope named like a partial prefix (cmu2 for cmu) is neither the source's own scope nor listed as also allowing it, and an exact-case mismatch (CMU) is not either.
   * Interacts with: the dialog's note lines, managedScopeOf.
   * Data: scopes for cmu2 and CMU; source cmu.
   */
  it('does not treat cmu2 or CMU as allowing cmu', async () => {
    const other: ModuleScope = { id: 's3', name: 'Other', paths: ['cmu2'] };
    const upper: ModuleScope = { id: 's4', name: 'Upper', paths: ['CMU'] };
    const { fixture } = await renderDialog({ scopes: [other, upper] });

    expect(screen.queryByText(/Also allowed/)).toBeNull();
    expect(fixture.componentInstance.current()).toBeNull();
  });

  /**
   * Verifies: when the projects cannot be listed the dialog says so and the save still closes without any request.
   * Interacts with: ProjectsService.getAllProjects (rejects).
   * Data: project list fails, nothing ticked.
   */
  it('says when the projects cannot be listed', async () => {
    const { assignmentsApi, close, user } = await renderDialog(
      {},
      { listFails: true },
    );

    expect(screen.getByText(/could not be listed/)).toBeInTheDocument();
    await user.click(save());
    expect(assignmentsApi.editAssignments).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
