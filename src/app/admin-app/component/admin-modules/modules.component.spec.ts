// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import userEvent from '@testing-library/user-event';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { screen, within } from '@testing-library/angular';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  Module,
  ModuleScope,
  ModuleScopesService,
  ModuleSource,
  ModulesService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import {
  PermissionGrants,
  permissionDataProviders,
} from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminModulesComponent } from './modules.component';
import {
  ProjectAccessDialogComponent,
  ProjectAccessDialogData,
} from './project-access-dialog/project-access-dialog.component';
import { GitlabProjectDialogComponent } from './gitlab-project-dialog/gitlab-project-dialog.component';

const healthy: ModuleSource = {
  name: 'local',
  provider: 'git',
  lastAttempt: '2026-10-14T12:30:00Z',
  lastSuccess: '2026-10-14T12:30:00Z',
  error: null,
};
const gitlab: ModuleSource = {
  name: 'gitlab',
  provider: 'gitlab',
  lastAttempt: '2026-10-14T13:00:00Z',
  lastSuccess: '2026-10-14T12:30:00Z',
  error: '401 Unauthorized',
};
const mirror: ModuleSource = {
  name: 'mirror',
  provider: 'git',
  lastAttempt: '2026-10-14T13:00:00Z',
  lastSuccess: null,
  error: 'clone failed',
};

const vm: Module = {
  id: 'mod1',
  name: 'vm',
  path: 'local/vm',
  description: 'A vSphere virtual machine',
  latestVersion: 'v1.2.0',
};
const stale: Module = {
  id: 'mod2',
  name: 'stale',
  path: 'local/stale',
  missingSince: '2026-11-01T12:00:00Z',
};
const stray: Module = { id: 'mod3', name: 'stray', path: 'elsewhere/stray' };

const cmuScope: ModuleScope = {
  id: 's1',
  name: 'CMU access',
  paths: ['local'],
  projects: [{ projectId: 'p1', name: 'Range A' }],
  projectGroups: [],
};

interface Options {
  modules?: Module[];
  sources?: () => Observable<ModuleSource[]>;
  scopes?: () => Observable<ModuleScope[]>;
  listModules?: () => Observable<Module[]>;
  confirmed?: boolean;
  /** What the GitLab project dialog returns when it closes; undefined is a cancel. */
  projectId?: string;
  sync?: () => Observable<unknown>;
  remove?: () => Observable<unknown>;
}

async function renderModules(
  grants: PermissionGrants,
  {
    modules = [vm],
    sources = () => of<ModuleSource[]>([healthy]),
    scopes = () => of<ModuleScope[]>([cmuScope]),
    listModules = () => of<Module[]>(modules),
    confirmed = true,
    projectId,
    sync = () => of(null),
    remove = () => of('mod1'),
  }: Options = {},
) {
  const modulesApi = {
    getAllModules: vi.fn(() => listModules()),
    getModuleSources: vi.fn(() => sources()),
    createTerrraformModuleFromRepository: vi.fn(() => sync()),
    deleteModule: vi.fn(() => remove()),
  } satisfies ApiStub<ModulesService>;
  const scopesApi = {
    getModuleScopes: vi.fn(() => scopes()),
    deleteModuleScope: vi.fn(() => of(undefined)),
  } satisfies Partial<ApiStub<ModuleScopesService>>;
  const open = vi.fn<
    (
      component: unknown,
      config: { data: ProjectAccessDialogData },
    ) => { afterClosed: () => Observable<string | undefined> }
  >(() => ({ afterClosed: () => of(projectId) }));
  const confirm = vi.fn(() => ({ afterClosed: () => of(confirmed) }));
  const view = await renderComponent(AdminModulesComponent, {
    imports: [MatIconModule, MatButtonModule, MatTooltipModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ModulesService, useValue: modulesApi },
      { provide: ModuleScopesService, useValue: scopesApi },
      { provide: MatDialog, useValue: { open } },
      { provide: CrucibleDialogService, useValue: { confirm } },
    ],
  });
  return {
    ...view,
    user: userEvent.setup(),
    modulesApi,
    scopesApi,
    open,
    confirm,
  };
}

/** The snack bar's text; its content stays aria-hidden until announced. */
function snackBarText(): string | null {
  return (
    document.querySelector('.mat-mdc-snack-bar-container')?.textContent ?? null
  );
}

/** The table row of a source, or of the leftover group, or null when it is not listed. */
function findRow(name: string): HTMLElement | null {
  const cell = [...document.querySelectorAll('.source-name')].find(
    (e) => e.textContent?.trim() === name,
  );
  return cell?.closest('tr') ?? null;
}

/** The table row of a source, or of the leftover group. */
function rowOf(name: string): HTMLElement {
  const row = findRow(name);
  if (!row) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

/** The names of the listed sources, in order. */
function listed(): string[] {
  return [...document.querySelectorAll('tr.element-row .source-name')].map(
    (e) => e.textContent?.trim() ?? '',
  );
}

const NOT_CONFIGURED = 'Not in a configured source';
const manage = { system: [SystemPermission.ManageModules] };
const manageAndView = {
  system: [SystemPermission.ManageModules, SystemPermission.ViewModules],
};
const view = { system: [SystemPermission.ViewModules] };

describe('AdminModulesComponent', () => {
  /**
   * Verifies: the page loads the modules with their version counts and latest versions, not all their versions, then asks for the sources once, after the modules, and shows one row per source.
   * Interacts with: ModulesService.getAllModules and getModuleSources (stubs), real ModuleService and ModuleQuery.
   * Data: sources local and gitlab; no permissions.
   */
  it('loads the modules, then the sources, and lists a row for each source', async () => {
    const { modulesApi } = await renderModules(
      {},
      { sources: () => of([healthy, gitlab]) },
    );

    expect(modulesApi.getAllModules).toHaveBeenCalledWith(
      false,
      true,
      false,
      undefined,
      undefined,
      true,
    );
    expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(1);
    expect(modulesApi.getAllModules.mock.invocationCallOrder[0]).toBeLessThan(
      modulesApi.getModuleSources.mock.invocationCallOrder[0],
    );
    expect(
      screen
        .getAllByRole('button', { name: /^Show details for / })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Show details for gitlab', 'Show details for local']);
  });

  /**
   * Verifies: the page has the standard admin toolbar (section icon, Search, paginator), a table of sources with the actions column first, and no Module Scopes panel or Add button; there is no separate Module Sources panel.
   * Interacts with: the toolbar and table templates.
   * Data: one source.
   */
  it('shows the toolbar and the table of sources, with no Module Scopes panel', async () => {
    await renderModules(manage);

    expect(screen.getByPlaceholderText('Search modules')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: /Items per page/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Module Sources')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('columnheader').map((h) => h.textContent?.trim()),
    ).toEqual(['', 'Name', 'Status', 'Modules', 'Projects', 'Last Updated']);
    expect(screen.queryByText('Module Scopes')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Add Module Scope' }),
    ).toBeNull();
  });

  /**
   * Verifies: a source row shows its name and description, its status icon and word (no time), its Module count, who may use it and when it was last updated, in columns.
   * Interacts with: the table templates, sourceStatus().
   * Data: TZ UTC; local with a description, read successfully, one Module, covered by CMU access.
   */
  it('shows a source in its columns', async () => {
    vi.stubEnv('TZ', 'UTC');
    await renderModules(view, {
      sources: () => of([{ ...healthy, description: 'Our modules' }]),
    });

    const cells = within(rowOf('local')).getAllByRole('cell');
    expect(cells[1].textContent).toContain('Our modules');
    expect(
      within(cells[2]).getByRole('img', { name: 'Read successfully' }),
    ).toBeInTheDocument();
    expect(cells[2].textContent?.trim()).toBe('Updated');
    expect(cells[2].textContent).not.toContain('2026');
    expect(cells[3].textContent?.trim()).toBe('1');
    expect(cells[4].textContent).toContain('Allowed for 1 project');
    expect(cells[5].textContent?.trim()).toBe('Oct 14, 2026, 12:30 PM UTC');
  });

  /**
   * Verifies: a failed source shows the word and its error as a muted second line with no time, keeps the time of the Modules still shown in the icon's tooltip and the Last Updated cell, and the Last Updated header explains itself.
   * Interacts with: the Status and Last Updated cells.
   * Data: TZ UTC; local failed with an older successful read.
   */
  it('keeps the time out of a failed status', async () => {
    vi.stubEnv('TZ', 'UTC');
    await renderModules(view, {
      sources: () => of([{ ...healthy, error: 'git down.' }]),
    });

    const cells = within(rowOf('local')).getAllByRole('cell');
    expect(cells[2].textContent).toContain('Last sync failed');
    expect(cells[2].textContent).toContain('git down.');
    expect(cells[2].textContent).not.toContain('2026');
    expect(
      within(cells[2]).getByRole('img', {
        name: "Couldn't be read. Showing its Modules from Oct 14, 2026, 12:30 PM UTC.",
      }),
    ).toBeInTheDocument();
    expect(cells[5].textContent?.trim()).toBe('Oct 14, 2026, 12:30 PM UTC');
  });

  /**
   * Verifies: a legacy scope limiting access to a folder of the source is not counted as allowing it, and a muted line says so, naming the scope in its tooltip.
   * Interacts with: the Projects column.
   * Data: a scope for local/exercise-x assigned to Range A, and no other scope.
   */
  it('notes a legacy folder scope without counting it', async () => {
    const folderScope: ModuleScope = {
      id: 's9',
      name: 'Old folder',
      paths: ['local/exercise-x'],
      projects: [{ projectId: 'p1', name: 'Range A' }],
      projectGroups: [],
    };
    await renderModules(view, { scopes: () => of([folderScope]) });

    const cell = within(rowOf('local')).getAllByRole('cell')[4];
    expect(cell.textContent).toContain(
      'Open to every project that has no source assigned (unless the deployment restricts them to shared sources)',
    );
    expect(cell.textContent).not.toContain('Allowed for');
    expect(cell.textContent).toContain(
      '1 scope limits access to folders of this source.',
    );
  });

  /**
   * Verifies: a shared source says it is open to every project with a lock-open icon, and its Project access button is disabled with the reason, so nothing opens.
   * Interacts with: the Projects column, the Project access button, MatDialog.open (stub).
   * Data: a shared source, ManageModules.
   */
  it('shows a shared source as open and explains Project access', async () => {
    const { open } = await renderModules(manageAndView, {
      sources: () => of([{ ...healthy, shared: true }]),
    });

    const cell = within(rowOf('local')).getAllByRole('cell')[4];
    expect(cell.textContent).toContain('Open to every project');
    expect(cell.querySelector('.mdi-lock-open-variant-outline')).toBeTruthy();
    const button = screen.getByRole('button', {
      name: 'Project access for local',
    });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAccessibleDescription(
      'Shared source: every project can use it, so there is nothing to assign',
    );
    expect(open).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a source opens in place when its chevron is clicked, with aria-expanded following and aria-controls naming the detail that holds its Modules, and closes again; its Modules are listed only while open.
   * Interacts with: the row's chevron button, the detail row's nested table.
   * Data: source local with Module vm.
   */
  it('expands and collapses a source in place', async () => {
    const { user } = await renderModules({});
    const chevron = screen.getByRole('button', {
      name: 'Show details for local',
    });

    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('vm')).not.toBeInTheDocument();

    await user.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    const detail = document.getElementById(
      chevron.getAttribute('aria-controls') ?? '',
    );
    expect(within(detail).getByText('vm')).toBeInTheDocument();

    await user.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('vm')).not.toBeInTheDocument();
  });

  /**
   * Verifies: the expand button takes keyboard focus and opens and closes its source with Enter and Space.
   * Interacts with: the row's chevron button.
   * Data: source local.
   */
  it('expands a source from the keyboard', async () => {
    const { user } = await renderModules({});

    const focused = screen.getByRole('button', {
      name: 'Show details for local',
    });
    focused.focus();
    await user.keyboard('{Enter}');
    expect(focused).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(focused).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * Verifies: the chevron is the first button of the actions cell, is a type=button, rotates through the expanded class while open, and the leftover group has the same chevron in the same place.
   * Interacts with: the actions cell, the chevron, the leftover row.
   * Data: source local; a Module in no source.
   */
  it('puts the chevron first in the actions cell and rotates it when open', async () => {
    const { user } = await renderModules(manage);
    const cell = within(rowOf('local')).getAllByRole('cell')[0];
    const first = within(cell).getAllByRole('button')[0];

    expect(first).toHaveAttribute('aria-label', 'Show details for local');
    expect(first).toHaveAttribute('type', 'button');
    expect(first).toHaveAttribute('aria-controls');
    expect(first).not.toHaveClass('expanded');
    expect(within(first).getByText('', { selector: '.chevron' })).toBeTruthy();
    expect(
      within(rowOf('local')).getAllByRole('cell')[1].querySelector('button'),
    ).toBeNull();

    await user.click(first);
    expect(first).toHaveClass('expanded');
    expect(first).toHaveAttribute('aria-label', 'Hide details for local');
  });

  /**
   * Verifies: clicking anywhere on a source's row opens it, but clicking one of its action buttons, or inside what it opened, does not toggle it.
   * Interacts with: the row's click handler, stopPropagation on the buttons, the separate detail row.
   * Data: source local with Module vm; ManageModules.
   */
  it('opens on a row click and ignores clicks on its buttons and detail', async () => {
    const { user } = await renderModules(manage, {
      sync: () => new Subject<unknown>(),
    });
    const chevron = screen.getByRole('button', {
      name: 'Show details for local',
    });

    await user.click(within(rowOf('local')).getAllByRole('cell')[3]);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Refresh local' }));
    await user.click(screen.getByText('vm'));
    expect(chevron).toHaveAttribute('aria-expanded', 'true');

    await user.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * Verifies: the group "Not in a configured source" holds leftovers and Modules of no configured source, is last, collapsed, and says how many there are.
   * Interacts with: the leftover row.
   * Data: stale (missingSince), stray (source elsewhere not configured), vm.
   */
  it('collects leftovers last in a collapsed row with their count', async () => {
    const { user } = await renderModules({}, { modules: [vm, stale, stray] });

    const group = rowOf(NOT_CONFIGURED);
    expect(within(group).getAllByRole('cell')[3].textContent?.trim()).toBe('2');
    expect(
      within(rowOf('local')).getAllByRole('cell')[3].textContent?.trim(),
    ).toBe('1');
    expect(screen.queryByText('stale')).not.toBeInTheDocument();
    expect(listed()).toEqual(['local', NOT_CONFIGURED]);
    // Not a configured source: no Refresh or Project access.
    expect(
      within(group).queryByRole('button', { name: /Refresh|access/ }),
    ).toBeNull();

    await user.click(
      screen.getByRole('button', {
        name: `Show details for ${NOT_CONFIGURED}`,
      }),
    );
    expect(screen.getByText('stale')).toBeInTheDocument();
    expect(screen.getByText('stray')).toBeInTheDocument();
  });

  /**
   * Verifies: the leftover row is hidden when there are none, and stays last whatever column and direction the sources are sorted by.
   * Interacts with: the sort headers, sortSourceRows().
   * Data: sources gitlab and local with a leftover stale.
   */
  it('keeps the leftover row last when sorting', async () => {
    const { user } = await renderModules(
      {},
      { modules: [vm, stale], sources: () => of([healthy, gitlab]) },
    );
    expect(listed()).toEqual(['gitlab', 'local', NOT_CONFIGURED]);

    await user.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(listed()).toEqual(['local', 'gitlab', NOT_CONFIGURED]);

    await user.click(screen.getByRole('columnheader', { name: 'Modules' }));
    expect(listed()).toEqual(['gitlab', 'local', NOT_CONFIGURED]);
  });

  /**
   * Verifies: with no leftover Modules there is no leftover row.
   * Interacts with: sourceTableRows().
   * Data: only vm, which is local's.
   */
  it('hides the leftover row when there are no leftovers', async () => {
    await renderModules({});

    expect(listed()).toEqual(['local']);
  });

  /**
   * Verifies: a search shows and opens only the sources with a matching Module, listing just those; the others are hidden, and clearing the search restores the rows and what was open before.
   * Interacts with: the Search box, the Clear Search button.
   * Data: local has vm and stale; gitlab has none; local was opened before searching.
   */
  it('searches across sources and restores the previous state when cleared', async () => {
    const { user } = await renderModules(
      {},
      {
        modules: [vm, { id: 'g1', name: 'dns', path: 'group/dns' }],
        sources: () => of([healthy, gitlab]),
      },
    );
    await user.click(
      screen.getByRole('button', { name: 'Show details for local' }),
    );

    await user.type(screen.getByPlaceholderText('Search modules'), 'dns');

    expect(findRow('local')).toBeNull();
    expect(listed()).toEqual(['gitlab']);
    expect(screen.getByText('dns')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide details for gitlab' }),
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(
      screen.getByRole('button', { name: 'Hide details for local' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Show details for gitlab' }),
    ).toBeTruthy();
    expect(screen.getByText('vm')).toBeInTheDocument();
  });

  /**
   * Verifies: the search matches a source on its own name, and says so when nothing matches.
   * Interacts with: the Search box.
   * Data: sources local and gitlab, no Module named gitlab.
   */
  it('matches a source by its own name and says when nothing matches', async () => {
    const { user } = await renderModules(
      {},
      { sources: () => of([healthy, gitlab]) },
    );
    const search = screen.getByPlaceholderText('Search modules');

    await user.type(search, 'gitl');
    expect(rowOf('gitlab')).toBeTruthy();
    expect(findRow('local')).toBeNull();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText(/No sources or Modules match "zzz"/)).toBeTruthy();
  });

  /**
   * Verifies: a user can still collapse a source the search opened, without losing what was opened before the search.
   * Interacts with: the Search box, the chevron.
   * Data: vm matches "vm".
   */
  it('lets the user collapse a source a search opened', async () => {
    const { user } = await renderModules({});
    await user.type(screen.getByPlaceholderText('Search modules'), 'vm');

    await user.click(
      screen.getByRole('button', { name: 'Hide details for local' }),
    );
    expect(screen.queryByText('A vSphere virtual machine')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(
      screen.getByRole('button', { name: 'Show details for local' }),
    ).toBeTruthy();
  });

  /**
   * Verifies: a source's own Search narrows its Modules further on top of the page's search, and the page's search leaves its Search box and page alone while the source stays open.
   * Interacts with: the page's Search box and the nested table's Search box.
   * Data: local has vm, vm-two and disk; the page searches "vm", the source's own search "two".
   */
  it('applies a source search on top of the page search', async () => {
    const { user } = await renderModules(
      {},
      {
        modules: [
          vm,
          { id: 'mod4', name: 'vm-two', path: 'local/vm-two' },
          { id: 'mod5', name: 'disk', path: 'local/disk' },
        ],
      },
    );
    await user.type(screen.getByPlaceholderText('Search modules'), 'vm');
    expect(screen.queryByText('disk')).toBeNull();
    expect(screen.getByText('vm-two')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search Modules'), 'two');
    expect(screen.queryByText('vm', { selector: 'td' })).toBeNull();
    expect(screen.getByText('vm-two')).toBeInTheDocument();
  });

  /**
   * Verifies: a source's open state and its own Search survive a Refresh, which replaces every row object.
   * Interacts with: the nested Search box, the row's Refresh, the reload.
   * Data: local with vm and disk, ManageModules.
   */
  it('keeps a source open with its own search through a Refresh', async () => {
    const { user } = await renderModules(manage, {
      modules: [vm, { id: 'mod5', name: 'disk', path: 'local/disk' }],
    });
    await user.click(
      screen.getByRole('button', { name: 'Show details for local' }),
    );
    await user.type(screen.getByLabelText('Search Modules'), 'disk');

    await user.click(screen.getByRole('button', { name: 'Refresh local' }));

    expect(screen.getByLabelText('Search Modules')).toHaveValue('disk');
    expect(
      screen.getByRole('button', { name: 'Hide details for local' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  /**
   * Verifies: when the API can't list its sources, the page says so and still lists every Module, under Not in a configured source, with no error escaping.
   * Interacts with: ModulesService.getModuleSources (throwError stub); test-setup fails any console.error.
   * Data: getModuleSources fails (an older API, or no ViewModules).
   */
  it('says the sources are not reported and still lists the modules', async () => {
    await renderModules(
      {},
      {
        sources: () => throwError(() => new HttpErrorResponse({ status: 404 })),
      },
    );

    expect(
      screen.getByText("This Caster API doesn't report its module sources."),
    ).toBeInTheDocument();
    expect(
      within(rowOf(NOT_CONFIGURED)).getAllByRole('cell')[3].textContent?.trim(),
    ).toBe('1');
  });

  /**
   * Verifies: with no source configured the page says so.
   * Interacts with: ModulesService.getModuleSources (stub).
   * Data: an empty source list.
   */
  it('says when no source is configured', async () => {
    await renderModules({}, { sources: () => of([]) });

    expect(
      screen.getByText(/No module sources are configured/),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: a failed source on page load opens no snack bar; its row is where it shows.
   * Interacts with: MatSnackBar (real, open spied).
   * Data: gitlab failed.
   */
  it('opens no snack bar for a failed source on page load', async () => {
    // render() waits out a snack bar's duration, so the spy is what can tell.
    const open = vi.spyOn(MatSnackBar.prototype, 'open');
    await renderModules({}, { sources: () => of([gitlab]) });

    expect(open).not.toHaveBeenCalled();
    expect(within(rowOf('gitlab')).getByText(/401 Unauthorized/)).toBeTruthy();
    expect(
      within(rowOf('gitlab')).getByRole('img', { name: /^Couldn't be read/ }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: ManageModules, which the API requires to refresh and delete Modules, enables Refresh All Sources and each source's Refresh; without it, even with ViewModules or ManageWorkspaces, they are greyed out with the permission as the reason, as on the other admin pages.
   * Interacts with: PermissionService.hasPermission (real).
   * Data: ManageModules, then near misses.
   */
  it.each([
    { label: 'ManageModules', grants: manage, editable: true },
    { label: 'ViewModules', grants: view, editable: false },
    {
      label: 'ManageWorkspaces',
      grants: { system: [SystemPermission.ManageWorkspaces] },
      editable: false,
    },
  ])(
    'gates refreshing on ManageModules ($label)',
    async ({ grants, editable }) => {
      await renderModules(grants);

      for (const name of ['Refresh All Sources', 'Refresh local']) {
        if (editable) {
          expect(screen.getByRole('button', { name })).toBeEnabled();
        } else {
          const button = screen.getByRole('button', {
            name: `${name} (not available)`,
          });
          expect(button).toBeDisabled();
          expect(button.parentElement).toHaveAccessibleDescription(
            'Refreshing Modules needs the ManageModules permission',
          );
        }
      }
    },
  );

  /**
   * Verifies: with no sources there is nothing to refresh, so Refresh All Sources is greyed out with that reason, even with ManageModules.
   * Interacts with: refreshAllReason().
   * Data: an empty source list.
   */
  it('greys out Refresh All Sources when there are no sources', async () => {
    await renderModules(manage, { sources: () => of([]) });

    const button = screen.getByRole('button', {
      name: 'Refresh All Sources (not available)',
    });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAccessibleDescription(
      'There are no module sources to refresh',
    );
  });

  /**
   * Verifies: the GitLab source has Add a GitLab Project in place of Refresh, which opens the dialog and refreshes the project ID it returns, and does nothing when it is cancelled; without ManageModules it is greyed out.
   * Interacts with: MatDialog.open (stub), the GitLab project dialog.
   * Data: gitlab source; project ID 42, then cancelled; ViewModules only.
   */
  it.each([
    { projectId: '42', calls: [[{ id: '42' }]] },
    { projectId: undefined, calls: [] },
  ])('adds a GitLab project ($projectId)', async ({ projectId, calls }) => {
    const { user, open, modulesApi } = await renderModules(manage, {
      sources: () => of([gitlab]),
      projectId,
    });

    expect(screen.queryByRole('button', { name: 'Refresh gitlab' })).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Add a GitLab Project' }),
    );

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe(GitlabProjectDialogComponent);
    expect(
      modulesApi.createTerrraformModuleFromRepository.mock.calls,
    ).toStrictEqual(calls);
  });

  it('greys out Add a GitLab Project without ManageModules', async () => {
    await renderModules(view, { sources: () => of([gitlab]) });

    expect(
      screen.getByRole('button', {
        name: 'Add a GitLab Project (not available)',
      }),
    ).toBeDisabled();
  });

  /**
   * Verifies: Copy repository URL is on a source's row only when the API reports its URL, and there is no Copy Terraform source anywhere.
   * Interacts with: repositoryUrl().
   * Data: local reports a URL, gitlab does not.
   */
  it('offers Copy repository URL only when the API reports one', async () => {
    await renderModules(manage, {
      sources: () =>
        of([
          {
            ...healthy,
            url: 'https://git.example.com/org/local.git',
          },
          gitlab,
        ]),
    });

    expect(
      screen.getByRole('button', { name: 'Copy the local repository URL' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Copy the gitlab repository URL' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Terraform source/ }),
    ).toBeNull();
  });

  describe('Module Scopes', () => {
    /**
     * Verifies: the scopes are read with one request for all of them, whatever the number of projects, and say on each source row who may use it.
     * Interacts with: ModuleScopesService.getModuleScopes (stub).
     * Data: one scope allowing local; ViewModules.
     */
    it('reads every scope in one request and shows who may use each source', async () => {
      const { scopesApi } = await renderModules(view);

      expect(scopesApi.getModuleScopes).toHaveBeenCalledTimes(1);
      expect(
        within(rowOf('local')).getByText(/1 project|Range A|Allowed/i),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: ManageModules alone is enough to read the scopes, as the API allows either permission.
     * Interacts with: ModuleScopesService.getModuleScopes (stub).
     * Data: ManageModules only.
     */
    it('reads the scopes with ManageModules alone', async () => {
      const { scopesApi } = await renderModules(manage);

      expect(scopesApi.getModuleScopes).toHaveBeenCalledTimes(1);
      expect(
        within(rowOf('local')).getByText('Allowed for 1 project'),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: without ViewModules or ManageModules no request is made, no scopes are passed on, and each row and the list say why.
     * Interacts with: ModuleScopesService.getModuleScopes (stub, must not be called).
     * Data: no permissions.
     */
    it('does not ask for the scopes without permission, and says why', async () => {
      const { scopesApi } = await renderModules({});

      expect(scopesApi.getModuleScopes).not.toHaveBeenCalled();
      expect(
        within(rowOf('local')).getByText(/ViewModules or ManageModules/),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: when the scopes cannot be read (an older API, a failure), the page still lists sources and modules and says the scopes could not be loaded, without an error escaping.
     * Interacts with: ModuleScopesService.getModuleScopes (rejects); test-setup fails any console.error.
     * Data: 404.
     */
    it('degrades to sources without access when the scopes cannot be read', async () => {
      await renderModules(view, {
        scopes: () => throwError(() => new Error('404')),
      });
      expect(
        within(rowOf('local')).getByText(/couldn't be loaded/),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: Project access on a source row opens the dialog for that source with the scopes the page already has, and no reload.
     * Interacts with: MatDialog.open (stub), the row's Project access button.
     * Data: ManageModules and ViewModules; source local, covered by CMU access.
     */
    it('opens the access dialog for a source with it pre-selected', async () => {
      const { user, open, modulesApi } = await renderModules(manageAndView);

      await user.click(
        screen.getByRole('button', { name: 'Project access for local' }),
      );

      expect(open).toHaveBeenCalledTimes(1);
      const [component, config] = open.mock.calls[0];
      expect(component).toBe(ProjectAccessDialogComponent);
      expect(config.data).toEqual({ source: 'local', scopes: [cmuScope] });
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);
    });

    /**
     * Verifies: while the scopes are still being read, Project access is disabled with a loading reason, the access cell says it is loading, and no dialog opens; once they arrive it works and passes them.
     * Interacts with: ModuleScopesService.getModuleScopes (Subject stub), MatDialog.open (stub), manageAccess().
     * Data: ManageModules and ViewModules; the scopes request stays pending.
     */
    it('waits for the scopes before Project access can open', async () => {
      const scopes = new Subject<ModuleScope[]>();
      const { user, fixture, open } = await renderModules(manageAndView, {
        scopes: () => scopes,
      });
      const button = screen.getByRole('button', {
        name: 'Project access for local',
      });

      expect(button).toBeDisabled();
      expect(button.parentElement).toHaveAccessibleDescription(
        'Loading who may use each source',
      );
      expect(
        within(rowOf('local')).getByText('Loading who may use each source'),
      ).toBeInTheDocument();
      fixture.componentInstance.manageAccess('local');
      expect(open).not.toHaveBeenCalled();

      scopes.next([cmuScope]);
      scopes.complete();
      fixture.detectChanges();
      expect(button).toBeEnabled();
      await user.click(button);

      expect(open.mock.calls[0][1].data.scopes).toEqual([cmuScope]);
    });

    /**
     * Verifies: manageAccess() refuses a shared source even when called around the disabled button.
     * Interacts with: MatDialog.open (stub).
     * Data: a shared source, ManageModules.
     */
    it('does not open the dialog for a shared source', async () => {
      const { fixture, open } = await renderModules(manageAndView, {
        sources: () => of([{ ...healthy, shared: true }]),
      });

      fixture.componentInstance.manageAccess('local');

      expect(open).not.toHaveBeenCalled();
    });

    /**
     * Verifies: the Projects column and its tooltip say the same thing about projects with no source assigned, naming both settings of the deployment, and not guessing one.
     * Interacts with: the Projects column and its tooltip.
     * Data: no scopes at all.
     */
    it('says what unassigned projects can use without guessing the deployment setting', async () => {
      await renderModules(view, { scopes: () => of([]) });

      const access = within(rowOf('local')).getAllByRole('cell')[4];
      expect(access.textContent).toContain(
        'Open to every project that has no source assigned (unless the deployment restricts them to shared sources)',
      );
    });

    /**
     * Verifies: without ManageModules Project access is disabled and nothing opens.
     * Interacts with: MatDialog.open (stub), the row's button.
     * Data: ViewModules only.
     */
    it('opens no dialog without ManageModules', async () => {
      const { open } = await renderModules(view);

      expect(
        screen.getByRole('button', { name: 'Project access for local' }),
      ).toBeDisabled();
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    const problem = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { title: 'The sources are down' },
          }),
      );

    /**
     * Verifies: when listing the Modules fails the page shows the API's problem text in a snack bar and clears its loading spinner.
     * Interacts with: ModulesService.getAllModules (throwError stub), real ModuleService and ModuleStore, MatSnackBar (real).
     * Data: a 500 with a problem title.
     */
    it('shows the problem and stops loading when listing the Modules fails', async () => {
      await renderModules(manage, { listModules: problem });

      expect(snackBarText()).toContain('The sources are down');
      expect(document.querySelector('.loading')).toBeNull();
    });

    /**
     * Verifies: a 404 on the source list is the quiet "does not report its sources" fallback with no snack bar.
     * Interacts with: ModulesService.getModuleSources (404 stub), MatSnackBar (spied).
     * Data: HTTP 404.
     */
    it('treats a 404 on the sources as an unsupported API, quietly', async () => {
      const open = vi.spyOn(MatSnackBar.prototype, 'open');
      await renderModules(manage, {
        sources: () => throwError(() => new HttpErrorResponse({ status: 404 })),
      });

      expect(
        screen.getByText("This Caster API doesn't report its module sources."),
      ).toBeInTheDocument();
      expect(open).not.toHaveBeenCalled();
    });

    /**
     * Verifies: any other failure of the source list shows the API's problem text in a snack bar, does not claim the API lacks the feature, and keeps the sources already listed.
     * Interacts with: ModulesService.getModuleSources (ok, then 500), Refresh All Sources, MatSnackBar (real).
     * Data: local listed on load; the list fails after Refresh All.
     */
    it('shows the problem and keeps the sources when the source list fails', async () => {
      const { user, modulesApi } = await renderModules(manage);
      modulesApi.getModuleSources.mockImplementationOnce(problem);

      await user.click(
        screen.getByRole('button', { name: 'Refresh All Sources' }),
      );

      expect(snackBarText()).toContain('The sources are down');
      expect(
        screen.queryByText(
          "This Caster API doesn't report its module sources.",
        ),
      ).toBeNull();
      expect(findRow('local')).not.toBeNull();
    });

    /**
     * Verifies: when the first read of the sources fails (not a 404) the page says it could not load them, with a Retry, and not that none are configured; Retry reads them again and lists the rows.
     * Interacts with: ModulesService.getModuleSources (500, then ok), MatSnackBar (real).
     * Data: a 500 first, then the healthy source.
     */
    it('shows a retry, not an empty configuration, when the sources fail to load', async () => {
      const { user, modulesApi } = await renderModules(manage, {
        sources: problem,
      });

      expect(screen.getByText(/Couldn't load the module sources/)).toBeTruthy();
      expect(screen.queryByText(/No module sources are configured/)).toBeNull();
      expect(findRow(NOT_CONFIGURED)).toBeNull();

      modulesApi.getModuleSources.mockImplementation(() => of([healthy]));
      await user.click(screen.getByRole('button', { name: 'Retry' }));

      expect(screen.queryByText(/Couldn't load the module sources/)).toBeNull();
      expect(findRow('local')).not.toBeNull();
    });

    /**
     * Verifies: clicking the wrapper of a greyed-out action explains it without opening or closing the row.
     * Interacts with: the row click handler, the disabled-action wrappers.
     * Data: no permissions, so Refresh and Project access are disabled.
     */
    it('does not toggle the row when a greyed-out action is clicked', async () => {
      const { user } = await renderModules({});
      const chevron = screen.getByRole('button', {
        name: 'Show details for local',
      });

      for (const name of [
        'Refresh local (not available)',
        'Project access for local',
      ]) {
        await user.click(screen.getByRole('button', { name }).parentElement);
      }

      expect(chevron).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Refresh All Sources', () => {
    /**
     * Verifies: Refresh All Sources marks every source refreshing, forces the API to re-read every version (unlike the page load), and clears the mark once the modules are back.
     * Interacts with: the toolbar button, ModulesService.getAllModules (Subject stub on the second call).
     * Data: healthy sources.
     */
    it('forces a re-read and shows every source refreshing until done', async () => {
      const { user, fixture, modulesApi } = await renderModules(manage);
      const reload = new Subject<Module[]>();
      modulesApi.getAllModules.mockImplementationOnce(() => reload);

      await user.click(
        screen.getByRole('button', { name: 'Refresh All Sources' }),
      );

      expect(modulesApi.getAllModules.mock.calls).toStrictEqual([
        [false, true, false, undefined, undefined, true],
        [false, true, true, undefined, undefined, true],
      ]);
      expect(
        screen.getByRole('button', { name: 'Refresh local' }),
      ).toBeDisabled();

      reload.next([vm]);
      reload.complete();
      fixture.detectChanges();

      expect(
        screen.getByRole('button', { name: 'Refresh local' }),
      ).toBeEnabled();
      expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: after Refresh All Sources, one snack bar names every source that failed; when all succeed none opens.
     * Interacts with: the toolbar button, ModulesService.getModuleSources (stub), MatSnackBar (real).
     * Data: healthy on page load; after the refresh, the sources in the row.
     */
    it.each([
      {
        label: 'one source',
        failed: [gitlab],
        message: "Module source gitlab couldn't be read",
      },
      {
        label: 'two sources',
        failed: [gitlab, mirror],
        message: "Module sources gitlab, mirror couldn't be read",
      },
    ])(
      'names the failed sources in a snack bar ($label)',
      async ({ failed, message }) => {
        let answer: ModuleSource[] = [healthy];
        const { user } = await renderModules(manage, {
          sources: () => of(answer),
        });

        answer = [healthy, ...failed];
        await user.click(
          screen.getByRole('button', { name: 'Refresh All Sources' }),
        );

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(snackBarText()).toContain('Dismiss');
      },
    );

    it('opens no snack bar when every source is read', async () => {
      const { user } = await renderModules(manage);

      await user.click(
        screen.getByRole('button', { name: 'Refresh All Sources' }),
      );

      // Read right away: whenStable() would wait out a snack bar's duration.
      expect(snackBarText()).toBeNull();
    });
  });

  describe('Refresh one', () => {
    /**
     * Verifies: refreshing one source row sends its name, marks only that id refreshing until the API answers, then reloads the modules and sources, and a source that was open stays open.
     * Interacts with: the row buttons, ModulesService.createTerrraformModuleFromRepository (Subject stub).
     * Data: source local from its row.
     */
    it('refreshes a source from its row', async () => {
      const id = 'local';
      const request = new Subject<unknown>();
      const { user, fixture, modulesApi } = await renderModules(manage, {
        sync: () => request,
      });
      await user.click(
        screen.getByRole('button', { name: 'Show details for local' }),
      );

      await user.click(screen.getByRole('button', { name: 'Refresh local' }));

      expect(
        modulesApi.createTerrraformModuleFromRepository.mock.calls,
      ).toStrictEqual([[{ id }]]);
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);

      request.next(null);
      request.complete();
      fixture.detectChanges();

      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(2);
      expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole('button', { name: 'Hide details for local' }),
      ).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('vm')).toBeInTheDocument();
    });

    /**
     * Verifies: a failed refresh shows the API's problem title, else the error message, else a generic message, in a snack bar; nothing is reloaded and no error escapes.
     * Interacts with: the row's Refresh, ModulesService.createTerrraformModuleFromRepository (throwError stub), MatSnackBar (real).
     * Data: source local; the error in the row.
     */
    it.each([
      {
        label: 'the problem title',
        error: { error: { title: 'No module source named web' } },
        message: 'No module source named web',
      },
      {
        label: 'the error message',
        error: new Error('Network down'),
        message: 'Network down',
      },
      {
        label: 'a generic message',
        error: {},
        message: "Couldn't refresh the Modules",
      },
    ])('shows $label when a refresh fails', async ({ error, message }) => {
      const { user, modulesApi } = await renderModules(manage, {
        sync: () => throwError(() => error),
      });

      await user.click(screen.getByRole('button', { name: 'Refresh local' }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(snackBarText()).toContain('Dismiss');
      expect(
        screen.getByRole('button', { name: 'Refresh local' }),
      ).toBeEnabled();
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);
    });
  });

  describe('the Modules table', () => {
    /**
     * Verifies: a source's nested Modules table has no Refresh button and no Last Synced column: a git Module is read with its source, so Refresh is on the source's row only.
     * Interacts with: the expanded source's table.
     * Data: local with vm, manage permission.
     */
    it('has no per-Module Refresh and no Last Synced column', async () => {
      const { user } = await renderModules(manage);
      await user.click(
        screen.getByRole('button', { name: 'Show details for local' }),
      );

      expect(screen.getByText('vm')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Refresh vm/ })).toBeNull();
      expect(
        screen.queryByRole('columnheader', { name: /Last Synced/ }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Refresh local' }),
      ).toBeInTheDocument();
    });
  });

  describe('Delete', () => {
    /**
     * Verifies: a leftover Module in Not in a configured source is deleted through the API once confirmed; a refusal deletes nothing.
     * Interacts with: the row's Delete button, CrucibleDialogService.confirm (stub), ModulesService.deleteModule (stub).
     * Data: stale (missingSince); confirmed, then not.
     */
    it.each([
      { confirmed: true, calls: [['mod2']] },
      { confirmed: false, calls: [] },
    ])(
      'deletes a leftover only when confirmed ($confirmed)',
      async ({ confirmed, calls }) => {
        const { user, modulesApi } = await renderModules(manage, {
          modules: [vm, stale],
          confirmed,
        });
        await user.click(
          screen.getByRole('button', {
            name: `Show details for ${NOT_CONFIGURED}`,
          }),
        );

        await user.click(screen.getByRole('button', { name: 'Delete stale' }));

        expect(modulesApi.deleteModule.mock.calls).toStrictEqual(calls);
      },
    );

    /**
     * Verifies: a Module still in its source has no Delete, as it would come back on the next read; without ManageModules nothing has one.
     * Interacts with: the table's action cells.
     * Data: vm with missingSince null, so the API reports it.
     */
    it('offers no Delete for a Module still in its source', async () => {
      const { user } = await renderModules(manage, {
        modules: [{ ...vm, missingSince: null }],
      });
      await user.click(
        screen.getByRole('button', { name: 'Show details for local' }),
      );

      expect(screen.queryByRole('button', { name: 'Delete vm' })).toBeNull();
    });
  });
});
