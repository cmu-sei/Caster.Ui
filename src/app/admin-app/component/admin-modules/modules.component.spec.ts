// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { ALL_SOURCES, AdminModulesComponent } from './modules.component';
import { AdminModuleListComponent } from './modules-list/module-list.component';
import { ModuleSourcesComponent } from './module-sources/module-sources.component';

@Component({
  selector: 'cas-admin-module-list',
  template: '',
})
class ModuleListStub {
  readonly modules = input<Module[]>(undefined);
  readonly sources = input<ModuleSource[]>([]);
  readonly isLoading = input<boolean>(undefined);
  readonly canEdit = input<boolean>(undefined);
  readonly refreshing = input<Set<string>>(new Set());
  readonly refresh = output<string>();
  readonly delete = output<string>();
}

@Component({
  selector: 'cas-module-sources',
  template: '',
})
class ModuleSourcesStub {
  readonly sources = input<ModuleSource[]>([]);
  readonly listed = input<boolean>(true);
  readonly canEdit = input<boolean>(false);
  readonly refreshing = input<Set<string>>(new Set());
  readonly refreshAll = output<void>();
  readonly refresh = output<string>();
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
  remove?: () => Observable<unknown>;
}

async function renderModules(
  grants: PermissionGrants,
  {
    sources = () => of<ModuleSource[]>([healthy]),
    sync = () => of(null),
    remove = () => of('mod1'),
  }: Options = {},
) {
  const modulesApi = {
    getAllModules: vi.fn(() =>
      of<Module[]>([{ id: 'mod1', name: 'vm', path: 'local/vm' }]),
    ),
    getModuleSources: vi.fn(() => sources()),
    createTerrraformModuleFromRepository: vi.fn(
      (_command?: CreateModuleRepositoryCommand) => sync(),
    ),
    deleteModule: vi.fn((_id: string) => remove()),
  } satisfies ApiStub<ModulesService>;
  const view = await renderComponent(AdminModulesComponent, {
    childStubs: [
      { replace: AdminModuleListComponent, with: ModuleListStub },
      { replace: ModuleSourcesComponent, with: ModuleSourcesStub },
    ],
    imports: [MatIconModule, MatButtonModule, MatTooltipModule],
    providers: [
      ...permissionDataProviders(grants),
      { provide: ModulesService, useValue: modulesApi },
    ],
  });
  const list: ModuleListStub = view.fixture.debugElement.query(
    By.directive(ModuleListStub),
  ).componentInstance;
  const panel: ModuleSourcesStub = view.fixture.debugElement.query(
    By.directive(ModuleSourcesStub),
  ).componentInstance;
  return { ...view, list, panel, modulesApi };
}

/** The snack bar's text; its content stays aria-hidden until announced. */
function snackBarText(): string | null {
  return (
    document.querySelector('.mat-mdc-snack-bar-container')?.textContent ?? null
  );
}

describe('AdminModulesComponent', () => {
  /**
   * Verifies: the page loads the modules with their versions and version counts and passes them, with loading cleared, to the list.
   * Interacts with: ModulesService.getAllModules (stub), real ModuleService and ModuleQuery.
   * Data: one module; no permissions.
   */
  it('loads the modules into the list', async () => {
    const { list, modulesApi } = await renderModules({});

    expect(modulesApi.getAllModules).toHaveBeenCalledWith(true, true, false);
    expect(list.modules().map((m) => m.id)).toEqual(['mod1']);
    expect(list.isLoading()).toBe(false);
  });

  /**
   * Verifies: listing the modules is what reads the sources, so the page asks for the sources once, after the modules, and hands them to both the Module Sources panel and the list.
   * Interacts with: ModulesService.getAllModules and getModuleSources (stubs), both child stubs.
   * Data: sources local and gitlab.
   */
  it('asks for the sources after the modules and passes them on', async () => {
    const { list, panel, modulesApi } = await renderModules(
      {},
      { sources: () => of([healthy, gitlab]) },
    );

    expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(1);
    expect(modulesApi.getAllModules.mock.invocationCallOrder[0]).toBeLessThan(
      modulesApi.getModuleSources.mock.invocationCallOrder[0],
    );
    expect(panel.sources().map((s) => s.name)).toEqual(['local', 'gitlab']);
    expect(list.sources().map((s) => s.name)).toEqual(['local', 'gitlab']);
    expect(panel.listed()).toBe(true);
  });

  /**
   * Verifies: a failed source on page load opens no snack bar; the Module Sources panel is where it shows.
   * Interacts with: MatSnackBar (real, open spied).
   * Data: gitlab failed.
   */
  it('opens no snack bar for a failed source on page load', async () => {
    // render() waits out a snack bar's duration, so the spy is what can tell.
    const open = vi.spyOn(MatSnackBar.prototype, 'open');
    await renderModules({}, { sources: () => of([gitlab]) });

    expect(open).not.toHaveBeenCalled();
  });

  /**
   * Verifies: when the API can't list its sources, the panel is told so, the modules are still listed, and no error escapes.
   * Interacts with: ModulesService.getModuleSources (throwError stub); test-setup fails any console.error.
   * Data: getModuleSources fails (an older API, or no ViewModules).
   */
  it('marks the sources unlisted when the API cannot list them', async () => {
    const { list, panel } = await renderModules(
      {},
      { sources: () => throwError(() => new Error('404')) },
    );

    expect(panel.listed()).toBe(false);
    expect(panel.sources()).toEqual([]);
    expect(list.modules().map((m) => m.id)).toEqual(['mod1']);
  });

  /**
   * Verifies: ManageModules, which the API requires to refresh and delete Modules, makes the panel and the list editable.
   * Interacts with: PermissionService.hasPermission (real), both stubs' canEdit inputs.
   * Data: system permission ManageModules.
   */
  it('passes canEdit true with ManageModules', async () => {
    const { list, panel } = await renderModules({
      system: [SystemPermission.ManageModules],
    });

    expect(list.canEdit()).toBe(true);
    expect(panel.canEdit()).toBe(true);
  });

  /**
   * Verifies: without ManageModules the page is read-only, including for ManageWorkspaces, which the page used to check by mistake.
   * Interacts with: PermissionService.hasPermission (real), both stubs' canEdit inputs.
   * Data: near misses: ViewModules, and ManageWorkspaces.
   */
  it.each([
    { label: 'ViewModules', system: [SystemPermission.ViewModules] },
    { label: 'ManageWorkspaces', system: [SystemPermission.ManageWorkspaces] },
  ])('passes canEdit false with $label only', async ({ system }) => {
    const { list, panel } = await renderModules({ system });

    expect(list.canEdit()).toBe(false);
    expect(panel.canEdit()).toBe(false);
  });

  describe('Refresh All Sources', () => {
    /**
     * Verifies: Refresh All Sources marks every source refreshing, forces the API to re-read every version (unlike the page load), and clears the mark once the modules are back.
     * Interacts with: the panel stub's refreshAll output and refreshing input, ModulesService.getAllModules (Subject stub on the second call).
     * Data: healthy sources.
     */
    it('forces a re-read and shows every source refreshing until done', async () => {
      const { fixture, panel, list, modulesApi } = await renderModules({});
      const reload = new Subject<Module[]>();
      modulesApi.getAllModules.mockImplementationOnce(() => reload);

      panel.refreshAll.emit();
      fixture.detectChanges();

      expect(modulesApi.getAllModules.mock.calls).toStrictEqual([
        [true, true, false],
        [true, true, true],
      ]);
      expect([...panel.refreshing()]).toEqual([ALL_SOURCES]);
      expect([...list.refreshing()]).toEqual([ALL_SOURCES]);

      reload.next([]);
      reload.complete();
      fixture.detectChanges();

      expect(panel.refreshing().size).toBe(0);
      expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: after Refresh All Sources, one snack bar names every source that failed; when all succeed none opens.
     * Interacts with: the panel stub's refreshAll output, ModulesService.getModuleSources (stub), MatSnackBar (real).
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
        const { fixture, panel } = await renderModules(
          {},
          { sources: () => of(answer) },
        );

        answer = [healthy, ...failed];
        panel.refreshAll.emit();
        fixture.detectChanges();

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(snackBarText()).toContain('Dismiss');
      },
    );

    it('opens no snack bar when every source is read', async () => {
      const { fixture, panel } = await renderModules({});

      panel.refreshAll.emit();
      fixture.detectChanges();

      // Read right away: whenStable() would wait out a snack bar's duration.
      expect(snackBarText()).toBeNull();
    });
  });

  describe('Refresh one', () => {
    /**
     * Verifies: refreshing one source (from the panel) or one Module (from the list) sends its id, marks only that id refreshing until the API answers, then reloads the modules and sources.
     * Interacts with: both stubs' refresh outputs and refreshing inputs, ModulesService.createTerrraformModuleFromRepository (Subject stub).
     * Data: source local from the panel; Module local/vm from the list.
     */
    it.each([
      { from: 'panel' as const, id: 'local' },
      { from: 'list' as const, id: 'local/vm' },
    ])('refreshes $id from the $from', async ({ from, id }) => {
      const request = new Subject<unknown>();
      const view = await renderModules({}, { sync: () => request });
      const { fixture, list, panel, modulesApi } = view;

      (from === 'panel' ? panel : list).refresh.emit(id);
      fixture.detectChanges();

      expect(
        modulesApi.createTerrraformModuleFromRepository.mock.calls,
      ).toStrictEqual([[{ id }]]);
      expect([...list.refreshing()]).toEqual([id]);
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);

      request.next(null);
      request.complete();
      fixture.detectChanges();

      expect(list.refreshing().size).toBe(0);
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(2);
      expect(modulesApi.getModuleSources).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: a failed refresh shows the API's problem title, else the error message, else a generic message, in a snack bar; the refreshing mark clears, nothing is reloaded and no error escapes.
     * Interacts with: the panel stub's refresh output, ModulesService.createTerrraformModuleFromRepository (throwError stub), MatSnackBar (real).
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
        message: "Couldn't refresh the Modules",
      },
    ])('shows $label when a refresh fails', async ({ error, message }) => {
      const { fixture, panel, list, modulesApi } = await renderModules(
        {},
        { sync: () => throwError(() => error) },
      );

      panel.refresh.emit('web');
      fixture.detectChanges();

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(snackBarText()).toContain('Dismiss');
      expect(list.refreshing().size).toBe(0);
      expect(list.isLoading()).toBe(false);
      expect(modulesApi.getAllModules).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Verifies: the list's delete output deletes the Module through the API.
   * Interacts with: the list stub's delete output, ModulesService.deleteModule (stub).
   * Data: mod1.
   */
  it('deletes a Module the list asks to delete', async () => {
    const { fixture, list, modulesApi } = await renderModules({});

    list.delete.emit('mod1');
    fixture.detectChanges();

    expect(modulesApi.deleteModule).toHaveBeenCalledWith('mod1');
  });
});
