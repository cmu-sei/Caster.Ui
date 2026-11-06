// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Observable, of, throwError } from 'rxjs';
import {
  CreateProjectCommand,
  EditProjectCommand,
  Project,
  ProjectPermission,
  ProjectsService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectMembershipsComponent } from 'src/app/project/component/project-memberships/project-memberships/project-memberships.component';
import {
  AdminProjectsComponent,
  formatCreated,
  problemText,
} from './admin-projects.component';

@Component({ selector: 'cas-project-memberships', template: '' })
class ProjectMembershipsStub {
  readonly projectId = input<string>(undefined);
  readonly showTitle = input(true);
}

const range: Project = {
  id: 'p1',
  name: 'Range',
  description: 'Cyber range build',
  dateCreated: '2026-10-14T12:30:00Z',
};
const lab: Project = {
  id: 'p2',
  name: 'Lab',
  description: 'Training lab',
  dateCreated: '2026-11-01T09:05:00Z',
};

interface Options {
  projects?: () => Observable<Project[]>;
  /** What the name dialog closes with. */
  named?: { nameValue: string; descriptionValue?: string };
  confirmAnswer?: boolean;
  create?: () => Observable<Project>;
  remove?: () => Observable<unknown>;
}

async function renderAdminProjects(
  grants: PermissionGrants = {},
  {
    projects = () => of([range, lab]),
    named,
    confirmAnswer,
    create = () => of({ id: 'p3', name: 'New' }),
    remove = () => of(null),
  }: Options = {},
) {
  const projectsApi = {
    getAllProjects: vi.fn((_onlyMine?: boolean) => projects()),
    createProject: vi.fn((_command?: CreateProjectCommand) => create()),
    editProject: vi.fn((_id: string, command?: EditProjectCommand) =>
      of({ ...range, ...command } as Project),
    ),
    deleteProject: vi.fn((_id: string) => remove()),
  } satisfies ApiStub<ProjectsService>;
  const nameRef = dialogRefStub<unknown, typeof named>(named);
  const open = vi.fn(() => ({
    ...nameRef.dialogRef,
    componentInstance: {} as Record<string, unknown>,
  }));
  const { dialogRef: confirmRef } = dialogRefStub<unknown, boolean>(
    confirmAnswer,
  );
  const confirm = vi.fn(() => confirmRef);
  const view = await renderComponent(AdminProjectsComponent, {
    childStubs: [
      { replace: ProjectMembershipsComponent, with: ProjectMembershipsStub },
    ],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ProjectsService, useValue: projectsApi },
      { provide: MatDialog, useValue: { open } },
      {
        provide: CrucibleDialogService,
        useValue: { confirm } satisfies Pick<CrucibleDialogService, 'confirm'>,
      },
    ],
  });
  return { ...view, projectsApi, open, confirm, user: userEvent.setup() };
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(`\\b${name}\\b`) });
}

function memberships(fixture: {
  debugElement: { queryAll: (p: unknown) => { componentInstance: unknown }[] };
}): ProjectMembershipsStub[] {
  return fixture.debugElement
    .queryAll(By.directive(ProjectMembershipsStub))
    .map((d) => d.componentInstance as ProjectMembershipsStub);
}

/** The snack bar's text; its content stays aria-hidden until announced. */
function snackBarText(): string | null {
  return (
    document.querySelector('.mat-mdc-snack-bar-container')?.textContent ?? null
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('formatCreated', () => {
  it('shows the date in the viewer zone, and nothing without one', () => {
    vi.stubEnv('TZ', 'UTC');
    expect(formatCreated('2026-10-14T12:30:00Z')).toBe(
      'Oct 14, 2026, 12:30 PM UTC',
    );
    expect(formatCreated(null)).toBe('');
  });
});

describe('problemText', () => {
  it.each([
    {
      error: { error: { title: 'Conflict', detail: 'Has Resources' } },
      text: 'Conflict: Has Resources',
    },
    { error: { error: { title: 'Forbidden' } }, text: 'Forbidden' },
    { error: new Error('Network down'), text: 'Network down' },
    { error: {}, text: 'fallback' },
  ])('reads $text', ({ error, text }) => {
    expect(problemText(error, 'fallback')).toBe(text);
  });
});

describe('AdminProjectsComponent', () => {
  /**
   * Verifies: the page lists every project (not only the user's) with Name, Description and Created in the viewer's zone, under one toolbar row with Search and the paginator and no "My Projects" title.
   * Interacts with: ProjectsService.getAllProjects (stub), the real ProjectService and ProjectQuery.
   * Data: TZ UTC; projects Range and Lab.
   */
  it('lists every project in the standard admin layout', async () => {
    vi.stubEnv('TZ', 'UTC');
    const { projectsApi } = await renderAdminProjects();

    expect(projectsApi.getAllProjects).toHaveBeenCalledWith(false);
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getByText('Items per page:')).toBeInTheDocument();
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('columnheader').map((h) => h.textContent.trim()),
    ).toEqual(['', 'Name', 'Description', 'Created']);
    expect(within(rowOf('Range')).getByText('Cyber range build')).toBeVisible();
    expect(
      within(rowOf('Range')).getByText('Oct 14, 2026, 12:30 PM UTC'),
    ).toBeVisible();
  });

  /**
   * Verifies: the list is sorted by name, and Search matches the description.
   * Interacts with: matSortActive, the filterPredicate.
   * Data: Range and Lab; "training" matches only Lab's description.
   */
  it('sorts by name and searches descriptions', async () => {
    const { user } = await renderAdminProjects();

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).queryAllByRole('cell')[1]?.textContent.trim())
      .filter((x) => !!x);
    expect(names).toEqual(['Lab', 'Range']);

    await user.type(screen.getByPlaceholderText('Search'), 'training');

    expect(rowOf('Lab')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /\bRange\b/ })).toBeNull();
  });

  /**
   * Verifies: with no projects the table says so, and a search with no match says what was searched.
   * Interacts with: the no-data row.
   * Data: no projects; then Range with search "zzz".
   */
  it('explains an empty table', async () => {
    await renderAdminProjects({}, { projects: () => of([]) });

    expect(screen.getByText('There are no Projects yet')).toBeInTheDocument();
  });

  it('says when no project matches the search', async () => {
    const { user } = await renderAdminProjects();

    await user.type(screen.getByPlaceholderText('Search'), 'zzz');

    expect(screen.getByText('No Projects match "zzz"')).toBeInTheDocument();
  });

  /**
   * Verifies: a failed project load shows the API's problem in a snack bar instead of the error dialog, and the spinner goes away.
   * Interacts with: ProjectsService.getAllProjects (throwError stub), MatSnackBar (real).
   * Data: a 403 problem.
   */
  it('reports a failed load in a snack bar', async () => {
    await renderAdminProjects(
      {},
      { projects: () => throwError(() => ({ error: { title: 'Forbidden' } })) },
    );

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  /**
   * Verifies: clicking a project's row opens its memberships under it, without the memberships view's own title; clicking another row moves them there; clicking again closes them.
   * Interacts with: the row click, the memberships stub's projectId and showTitle inputs.
   * Data: Range, then Lab.
   */
  it('opens one project memberships in place', async () => {
    const { fixture, user } = await renderAdminProjects();

    await user.click(within(rowOf('Range')).getByText('Range'));
    expect(memberships(fixture).map((m) => m.projectId())).toEqual(['p1']);
    expect(memberships(fixture)[0].showTitle()).toBe(false);
    expect(rowOf('Range')).toHaveAttribute('aria-expanded', 'true');

    await user.click(within(rowOf('Lab')).getByText('Lab'));
    expect(memberships(fixture).map((m) => m.projectId())).toEqual(['p2']);

    await user.click(within(rowOf('Lab')).getByText('Lab'));
    expect(memberships(fixture)).toEqual([]);
  });

  /**
   * Verifies: each row opens its project in a new tab without expanding the row.
   * Interacts with: the Open link.
   * Data: Range.
   */
  it('opens a project in a new tab', async () => {
    const { fixture } = await renderAdminProjects();

    const open = within(rowOf('Range')).getByRole('link', {
      name: 'Open Range',
    });
    expect(open).toHaveAttribute('href', '/projects/p1');
    expect(open).toHaveAttribute('target', '_blank');
    open.click();
    fixture.detectChanges();
    expect(memberships(fixture)).toEqual([]);
  });

  describe('permissions', () => {
    /**
     * Verifies: Add New Project needs CreateProjects; without it the button is shown disabled.
     * Interacts with: PermissionService (real) over stubbed claims.
     * Data: CreateProjects, or none.
     */
    it.each([
      { system: [SystemPermission.CreateProjects], enabled: true },
      { system: [], enabled: false },
    ])('Add New Project enabled: $enabled', async ({ system, enabled }) => {
      await renderAdminProjects({ system });

      const button = screen.getByRole('button', {
        name: enabled ? 'Add New Project' : 'Add New Project (not available)',
      });
      expect(button.hasAttribute('disabled')).toBe(!enabled);
    });

    /**
     * Verifies: Rename and Delete need EditProjects, or EditProject on that project, as the API requires; ManageProjects alone is not enough.
     * Interacts with: PermissionService (real) over stubbed system and project claims.
     * Data: the grants in the row; Range is p1.
     */
    it.each([
      {
        label: 'EditProjects',
        grants: { system: [SystemPermission.EditProjects] },
        range: true,
        lab: true,
      },
      {
        label: 'EditProject on Range',
        grants: {
          projects: [
            { projectId: 'p1', permissions: [ProjectPermission.EditProject] },
          ],
        },
        range: true,
        lab: false,
      },
      {
        label: 'ManageProjects only',
        grants: { system: [SystemPermission.ManageProjects] },
        range: false,
        lab: false,
      },
    ])('gates Rename and Delete with $label', async (row) => {
      await renderAdminProjects(row.grants);

      for (const [name, allowed] of [
        ['Range', row.range],
        ['Lab', row.lab],
      ] as const) {
        const scope = within(rowOf(name));
        if (allowed) {
          expect(
            scope.getByRole('button', { name: `Rename ${name}` }),
          ).toBeEnabled();
          expect(
            scope.getByRole('button', { name: `Delete ${name}` }),
          ).toBeEnabled();
        } else {
          expect(
            scope.getByRole('button', {
              name: `Rename ${name} (not available)`,
            }),
          ).toBeDisabled();
          expect(
            scope.getByRole('button', {
              name: `Delete ${name} (not available)`,
            }),
          ).toBeDisabled();
        }
      }
    });
  });

  describe('changes', () => {
    /**
     * Verifies: Add New Project asks for a name and description, creates the project, adds it to the table and confirms in a snack bar.
     * Interacts with: MatDialog.open (stub closing with a name), ProjectsService.createProject (stub).
     * Data: CreateProjects; name New, description Fresh.
     */
    it('adds a project', async () => {
      const { projectsApi, open, user } = await renderAdminProjects(
        { system: [SystemPermission.CreateProjects] },
        {
          named: { nameValue: 'New', descriptionValue: 'Fresh' },
          create: () => of({ id: 'p3', name: 'New', description: 'Fresh' }),
        },
      );

      await user.click(screen.getByRole('button', { name: 'Add New Project' }));

      expect(open).toHaveBeenCalledTimes(1);
      expect(projectsApi.createProject).toHaveBeenCalledWith({
        name: 'New',
        description: 'Fresh',
      });
      expect(await screen.findByText('Added Project New')).toBeInTheDocument();
      expect(rowOf('New')).toBeInTheDocument();
    });

    /**
     * Verifies: cancelling the name dialog creates nothing.
     * Interacts with: MatDialog.open (stub that closes with nothing).
     * Data: CreateProjects.
     */
    it('adds nothing when the dialog is cancelled', async () => {
      const { projectsApi, user } = await renderAdminProjects({
        system: [SystemPermission.CreateProjects],
      });

      await user.click(screen.getByRole('button', { name: 'Add New Project' }));

      expect(projectsApi.createProject).not.toHaveBeenCalled();
    });

    /**
     * Verifies: Rename saves the new name and description without expanding the row, and confirms it.
     * Interacts with: MatDialog.open (stub), ProjectsService.editProject (stub).
     * Data: EditProjects; Range renamed to Range 2.
     */
    it('renames a project', async () => {
      const { fixture, projectsApi, user } = await renderAdminProjects(
        { system: [SystemPermission.EditProjects] },
        { named: { nameValue: 'Range 2', descriptionValue: 'Bigger' } },
      );

      await user.click(
        within(rowOf('Range')).getByRole('button', { name: 'Rename Range' }),
      );

      expect(projectsApi.editProject).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ name: 'Range 2', description: 'Bigger' }),
      );
      expect(
        await screen.findByText('Saved Project Range 2'),
      ).toBeInTheDocument();
      expect(memberships(fixture)).toEqual([]);
    });

    /**
     * Verifies: Delete asks first, deletes the project once confirmed, removes its row and confirms it; cancelling deletes nothing.
     * Interacts with: CrucibleDialogService.confirm (stub), ProjectsService.deleteProject (stub).
     * Data: EditProjects; Range.
     */
    it('deletes a project after confirmation', async () => {
      const { projectsApi, confirm, user } = await renderAdminProjects(
        { system: [SystemPermission.EditProjects] },
        { confirmAnswer: true },
      );

      await user.click(
        within(rowOf('Range')).getByRole('button', { name: 'Delete Range' }),
      );

      expect(confirm).toHaveBeenCalledWith({
        title: 'Delete Project',
        message: 'Are you sure that you want to delete Range?',
        confirmText: 'Delete',
      });
      expect(projectsApi.deleteProject).toHaveBeenCalledWith('p1');
      expect(
        await screen.findByText('Deleted Project Range'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('row', { name: /\bRange\b/ })).toBeNull();
    });

    it('deletes nothing when the confirmation is cancelled', async () => {
      const { projectsApi, user } = await renderAdminProjects(
        { system: [SystemPermission.EditProjects] },
        { confirmAnswer: false },
      );

      await user.click(
        within(rowOf('Range')).getByRole('button', { name: 'Delete Range' }),
      );

      expect(projectsApi.deleteProject).not.toHaveBeenCalled();
    });

    /**
     * Verifies: when the API refuses a delete (deployed resources or pending runs), its problem shows in a snack bar and the project stays listed.
     * Interacts with: ProjectsService.deleteProject (throwError stub), MatSnackBar (real).
     * Data: a 409 "Cannot delete a Project with deployed Resources."
     */
    it('shows why the API refused a delete', async () => {
      await renderAdminProjects(
        { system: [SystemPermission.EditProjects] },
        {
          confirmAnswer: true,
          remove: () =>
            throwError(() => ({
              error: {
                title: 'Cannot delete a Project with deployed Resources.',
              },
            })),
        },
      );
      const user = userEvent.setup();

      await user.click(
        within(rowOf('Range')).getByRole('button', { name: 'Delete Range' }),
      );

      expect(
        await screen.findByText(
          'Cannot delete a Project with deployed Resources.',
        ),
      ).toBeInTheDocument();
      expect(snackBarText()).toContain('Dismiss');
      expect(rowOf('Range')).toBeInTheDocument();
    });
  });
});
