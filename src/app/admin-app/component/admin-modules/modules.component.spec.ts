// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  CreateModuleRepositoryCommand,
  Module,
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
import { AdminModuleListComponent } from 'src/app/admin-app/component/admin-modules/modules-list/module-list.component';

@Component({
  selector: 'cas-admin-module-list',
  template: '',
})
class ModuleListStub {
  readonly modules = input<Module[]>(undefined);
  readonly isLoading = input<boolean>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly load = output<boolean>();
  readonly loadModuleById = output<string>();
  readonly delete = output<string>();
}

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

interface Options {
  sources?: () => Observable<ModuleSource[]>;
  sync?: () => Observable<unknown>;
}

async function renderModules(
  grants: PermissionGrants,
  {
    sources = () => of<ModuleSource[]>([healthy]),
    sync = () => of(null),
  }: Options = {},
) {
  const modulesApi = {
    getAllModules: vi.fn(() =>
      of<Module[]>([{ id: 'mod1', name: 'vm', path: 'group/vm' }]),
    ),
    getModuleSources: vi.fn(() => sources()),
    createTerrraformModuleFromRepository: vi.fn(
      (_command?: CreateModuleRepositoryCommand) => sync(),
    ),
  } satisfies ApiStub<ModulesService>;
  const view = await renderComponent(AdminModulesComponent, {
    childStubs: [{ replace: AdminModuleListComponent, with: ModuleListStub }],
    imports: [MatIconModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ModulesService, useValue: modulesApi },
    ],
  });
  const list: ModuleListStub = view.fixture.debugElement.query(
    By.directive(ModuleListStub),
  ).componentInstance;
  return { ...view, list, modulesApi };
}

/** The text of an element with its whitespace collapsed, as the user reads it. */
function text(element: HTMLElement): string {
  return element.textContent.replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AdminModulesComponent', () => {
  /**
   * Verifies: the page loads the modules with version counts and passes them, with loading cleared, to the list.
   * Interacts with: ModulesService.getAllModules (stub), real ModuleService and ModuleQuery.
   * Data: one module; no permissions.
   */
  it('loads the modules into the list', async () => {
    const { list, modulesApi } = await renderModules({});

    expect(modulesApi.getAllModules).toHaveBeenCalledWith(false, true);
    expect(list.modules().map((m) => m.id)).toEqual(['mod1']);
    expect(list.isLoading()).toBe(false);
  });

  /**
   * Verifies: the ManageWorkspaces system permission makes the module list editable (current behavior).
   * Interacts with: PermissionService.hasPermission (real), the list stub's canEdit input.
   * Data: system permission ManageWorkspaces.
   */
  it('passes canEdit true with ManageWorkspaces', async () => {
    const { list } = await renderModules({
      system: [SystemPermission.ManageWorkspaces],
    });

    expect(list.canEdit()).toBe(true);
  });

  /**
   * Verifies: without ManageWorkspaces the module list is read-only, also for a user who holds ManageModules (current behavior).
   * Interacts with: PermissionService.hasPermission (real), the list stub's canEdit input.
   * Data: near misses: ViewWorkspaces, and ManageModules plus ViewModules.
   */
  it.each([
    { label: 'ViewWorkspaces', system: [SystemPermission.ViewWorkspaces] },
    {
      label: 'ManageModules',
      system: [SystemPermission.ManageModules, SystemPermission.ViewModules],
    },
  ])('passes canEdit false with $label only', async ({ system }) => {
    const { list } = await renderModules({ system });

    // Current behavior; see agent-docs/ui-test-bugs/caster.ui.md.
    expect(list.canEdit()).toBe(false);
  });

  describe('module source sync', () => {
    /**
     * Verifies: once the modules are listed (which syncs the sources), the page asks for the sources once and shows no warning when every source synced.
     * Interacts with: ModulesService.getAllModules and getModuleSources (stubs), real ModuleService.
     * Data: one healthy source local; no permissions.
     */
    it('asks for the module sources after loading the modules', async () => {
      const { modulesApi } = await renderModules({});

      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);
      expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(1);
      expect(modulesApi.getAllModules.mock.invocationCallOrder[0]).toBeLessThan(
        modulesApi.getModuleSources.mock.invocationCallOrder[0],
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    /**
     * Verifies: each failed source gets its own warning naming it, saying whether the list shows its last successful sync (with that time in the viewer's zone) or only the modules already stored, and giving its error; a healthy source gets none, and the page load itself opens no snack bar.
     * Interacts with: ModulesService.getModuleSources (stub), syncTime, MatSnackBar (real, open spied).
     * Data: TZ UTC; sources local (healthy), gitlab (failed, last success 2026-10-14 12:30 UTC, 401 Unauthorized), mirror (failed, never synced, clone failed).
     */
    it('warns about each module source that failed to sync', async () => {
      vi.stubEnv('TZ', 'UTC');
      // The real snack bar runs; render() waits out a snack bar's 5 s
      // duration timer, so one opened on load is gone before the DOM can be
      // read, and the spy is what can tell.
      const open = vi.spyOn(MatSnackBar.prototype, 'open');
      await renderModules({}, { sources: () => of([healthy, gitlab, mirror]) });

      expect(screen.getAllByRole('alert').map(text)).toEqual([
        'Module source gitlab failed to sync. Showing its Modules from the last successful sync, Oct 14, 2026, 12:30 PM UTC. 401 Unauthorized',
        'Module source mirror failed to sync. Showing the Modules already stored. clone failed',
      ]);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(open).not.toHaveBeenCalled();
    });

    /**
     * Verifies: with no source configured the page says no modules can be synced, and shows no failure warning.
     * Interacts with: ModulesService.getModuleSources (stub returning []).
     * Data: no sources.
     */
    it('says when no module source is configured', async () => {
      await renderModules({}, { sources: () => of<ModuleSource[]>([]) });

      expect(text(screen.getByRole('status'))).toBe(
        'No module source is configured, so no Modules can be synced.',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    /**
     * Verifies: when the sources cannot be listed the page shows no warning and logs no error, and still lists the modules.
     * Interacts with: ModulesService.getModuleSources (throwError stub), the list stub's modules input; test-setup fails any console.error.
     * Data: getModuleSources fails with a 404 (an older API) or a 403 (no ViewModules).
     */
    it('shows no source warning when the sources cannot be listed', async () => {
      const { list } = await renderModules(
        {},
        { sources: () => throwError(() => new Error('404')) },
      );

      expect(list.modules().map((m) => m.id)).toEqual(['mod1']);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    /**
     * Verifies: when a requested sync cannot list the sources, the warning shown on page load is cleared rather than kept, no snack bar opens and no error is logged.
     * Interacts with: the list stub's load output, ModulesService.getModuleSources (stub answering, then throwing), MatSnackBar (real); test-setup fails any console.error.
     * Data: gitlab failed on page load; the requested sync's getModuleSources fails with a 403.
     */
    it('clears the source warning when a later source listing fails', async () => {
      let sources: () => Observable<ModuleSource[]> = () => of([gitlab]);
      const { fixture, list, modulesApi } = await renderModules(
        {},
        { sources: () => sources() },
      );
      expect(screen.getAllByRole('alert')).toHaveLength(1);

      sources = () => throwError(() => new Error('403'));
      list.load.emit(true);
      fixture.detectChanges();

      // Read right away: whenStable() would wait out a snack bar's duration.
      expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    });

    /**
     * Verifies: when the user asks the list to update every source, the page reloads the modules and the sources, and one snack bar with Dismiss names every failed source; the warnings follow the new answer.
     * Interacts with: the list stub's load output, ModulesService.getAllModules and getModuleSources (stubs), MatSnackBar (real).
     * Data: healthy sources on page load; after the update, the sources in the row.
     */
    it.each([
      {
        label: 'one source',
        failed: [gitlab],
        message: 'Module source gitlab failed to sync',
      },
      {
        label: 'two sources',
        failed: [gitlab, mirror],
        message: 'Module sources gitlab, mirror failed to sync',
      },
    ])(
      'names the failed sources in a snack bar after a requested sync ($label)',
      async ({ failed, message }) => {
        let answer: ModuleSource[] = [healthy];
        const { fixture, list, modulesApi } = await renderModules(
          {},
          { sources: () => of(answer) },
        );
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        answer = [healthy, ...failed];
        list.load.emit(true);
        fixture.detectChanges();

        expect(modulesApi.getAllModules).toHaveBeenCalledTimes(2);
        expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(2);
        expect(await screen.findByText(message)).toBeInTheDocument();
        // The snack bar's content stays aria-hidden until it is announced.
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
        expect(screen.getAllByRole('alert')).toHaveLength(failed.length);
      },
    );

    /**
     * Verifies: a requested sync in which every source synced opens no snack bar, and clears an earlier warning.
     * Interacts with: the list stub's load output, ModulesService.getModuleSources (stub), MatSnackBar (real).
     * Data: gitlab failed on page load; healthy sources after the update.
     */
    it('opens no snack bar when a requested sync succeeds', async () => {
      let answer: ModuleSource[] = [gitlab];
      const { fixture, list } = await renderModules(
        {},
        { sources: () => of(answer) },
      );
      expect(screen.getAllByRole('alert')).toHaveLength(1);

      answer = [healthy];
      list.load.emit(true);
      fixture.detectChanges();

      // Read right away: whenStable() would wait out a snack bar's duration.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    });

    /**
     * Verifies: syncing one source or module sends its id, keeps loading on until the API answers, then reloads the modules and the sources, showing the new warnings without a snack bar.
     * Interacts with: the list stub's loadModuleById output and isLoading input, ModulesService.createTerrraformModuleFromRepository (Subject stub), getAllModules and getModuleSources (stubs), MatSnackBar (real).
     * Data: id gitlab; the sources answer gitlab failed after the sync.
     */
    it('syncs the entered source and reloads the modules', async () => {
      const request = new Subject<unknown>();
      let answer: ModuleSource[] = [healthy];
      const { fixture, list, modulesApi } = await renderModules(
        {},
        { sources: () => of(answer), sync: () => request },
      );

      list.loadModuleById.emit('gitlab');
      fixture.detectChanges();

      expect(
        modulesApi.createTerrraformModuleFromRepository.mock.calls,
      ).toStrictEqual([[{ id: 'gitlab' }]]);
      expect(list.isLoading()).toBe(true);
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);

      answer = [gitlab];
      request.next(null);
      request.complete();
      fixture.detectChanges();

      // Read right away: whenStable() would wait out a snack bar's duration.
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(2);
      expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(2);
      expect(list.isLoading()).toBe(false);
      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(
        screen.queryByText('Module source gitlab failed to sync'),
      ).not.toBeInTheDocument();
    });

    /**
     * Verifies: a failed sync of one source shows the API's problem title, else the error message, else a generic message, in a snack bar; loading clears, nothing is reloaded and no error escapes.
     * Interacts with: the list stub's loadModuleById output and isLoading input, ModulesService.createTerrraformModuleFromRepository (throwError stub), MatSnackBar (real).
     * Data: id web; the error in the row.
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
        message: 'Failed to update the Modules',
      },
    ])(
      'shows $label when syncing a source fails',
      async ({ error, message }) => {
        const { fixture, list, modulesApi } = await renderModules(
          {},
          { sync: () => throwError(() => error) },
        );

        list.loadModuleById.emit('web');
        fixture.detectChanges();

        expect(await screen.findByText(message)).toBeInTheDocument();
        // The snack bar's content stays aria-hidden until it is announced.
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
        expect(list.isLoading()).toBe(false);
        expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);
        expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(1);
      },
    );
  });
});
