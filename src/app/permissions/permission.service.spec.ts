// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  defer,
  firstValueFrom,
  Observable,
  of,
  Subject,
  throwError,
} from 'rxjs';
import {
  GroupPermission,
  GroupPermissionsClaim,
  GroupPermissionsService,
  ProjectPermission,
  ProjectPermissionsClaim,
  ProjectPermissionsService,
  SystemPermission,
  SystemPermissionsService,
} from '../generated/caster-api';
import { ApiStub } from '../test-utils/api-stub';
import { getDefaultProviders } from '../test-utils/default-test-providers';
import { recordEmissions } from '../test-utils/record-emissions';
import { PermissionService } from './permission.service';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Responses {
  system?: SystemPermission[];
  project?: ProjectPermissionsClaim[];
  group?: GroupPermissionsClaim[];
}

/**
 * The real PermissionService with its three generated "mine" endpoints
 * stubbed. The stubs answer with `responses`, so a test loads permissions the
 * way the app does (topbar/admin/project components call load*() and
 * subscribe) instead of poking the private subjects.
 */
function setup(responses: Responses = {}) {
  const systemApi = {
    getMySystemPermissions: vi.fn(() => of(responses.system ?? [])),
  } satisfies ApiStub<SystemPermissionsService>;
  const projectApi = {
    getMyProjectPermissions: vi.fn((_projectId?: string) =>
      of(responses.project ?? []),
    ),
  } satisfies ApiStub<ProjectPermissionsService>;
  const groupApi = {
    getMyGroupPermissions: vi.fn((_groupId?: string) =>
      of(responses.group ?? []),
    ),
  } satisfies ApiStub<GroupPermissionsService>;

  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      // The real service, replacing the default placeholder.
      PermissionService,
      { provide: SystemPermissionsService, useValue: systemApi },
      { provide: ProjectPermissionsService, useValue: projectApi },
      { provide: GroupPermissionsService, useValue: groupApi },
    ]),
  });
  return {
    service: TestBed.inject(PermissionService),
    systemApi,
    projectApi,
    groupApi,
  };
}

/** setup() followed by every load the app performs. */
async function loaded(responses: Responses) {
  const ctx = setup(responses);
  await firstValueFrom(ctx.service.load());
  await firstValueFrom(ctx.service.loadProjectPermissions());
  await firstValueFrom(ctx.service.loadGroupPermissions());
  return ctx;
}

const current = (obs$: Observable<boolean>) => firstValueFrom(obs$);

const projectClaim = (
  projectId: string,
  ...permissions: ProjectPermission[]
): ProjectPermissionsClaim => ({ projectId, permissions });

const groupClaim = (
  groupId: string,
  ...permissions: GroupPermission[]
): GroupPermissionsClaim => ({ groupId, permissions });

const allSystemPermissions = Object.values(SystemPermission);
const viewPermissions = allSystemPermissions.filter((p) =>
  p.startsWith('View'),
);
const nonViewPermissions = allSystemPermissions.filter(
  (p) => !p.startsWith('View'),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PermissionService', () => {
  describe('before permissions load', () => {
    /**
     * Verifies: every check emits false until a load completes, and constructing the service calls no API.
     * Interacts with: the three generated permission APIs (stubs, asserted not called).
     * Data: no load*() call; the APIs would grant everything if asked.
     */
    it('denies every check and calls no API', async () => {
      const { service, systemApi, projectApi, groupApi } = setup({
        system: allSystemPermissions,
        project: [projectClaim('p1', ...Object.values(ProjectPermission))],
        group: [groupClaim('g1', ...Object.values(GroupPermission))],
      });

      const checks = await Promise.all([
        current(service.hasPermission(SystemPermission.ViewProjects)),
        current(service.canViewAdiminstration()),
        current(service.canViewGroupsAdmin()),
        current(service.canEditProject('p1')),
        current(service.canManageProject('p1')),
        current(service.canAdminLockProject('p1')),
        current(service.canManageGroup('g1')),
        current(service.canEditGroup('g1')),
      ]);

      expect(checks).toEqual(Array(8).fill(false));
      expect(systemApi.getMySystemPermissions).not.toHaveBeenCalled();
      expect(projectApi.getMyProjectPermissions).not.toHaveBeenCalled();
      expect(groupApi.getMyGroupPermissions).not.toHaveBeenCalled();
    });

    /**
     * Verifies: a check subscribed before the load re-emits true once the load completes, so templates update without resubscribing.
     * Interacts with: SystemPermissionsService.getMySystemPermissions (stub), PermissionService.permissions$.
     * Data: hasPermission(ManageUsers) subscribed first; load() then returns [ManageUsers].
     */
    it('re-emits a check when permissions arrive', async () => {
      const { service } = setup({ system: [SystemPermission.ManageUsers] });
      const emissions = recordEmissions(
        service.hasPermission(SystemPermission.ManageUsers),
      );

      await firstValueFrom(service.load());

      expect(emissions).toEqual([false, true]);
    });
  });

  describe('load() and hasPermission()', () => {
    /**
     * Verifies: load() fetches the current user's system permissions and publishes them on permissions$.
     * Interacts with: SystemPermissionsService.getMySystemPermissions (stub), permissions$.
     * Data: the API returns [ViewProjects, LockFiles].
     */
    it('publishes the loaded system permissions', async () => {
      const perms = [SystemPermission.ViewProjects, SystemPermission.LockFiles];
      const { service, systemApi } = setup({ system: perms });

      const result = await firstValueFrom(service.load());

      expect(systemApi.getMySystemPermissions).toHaveBeenCalledTimes(1);
      expect(result).toEqual(perms);
      expect(await firstValueFrom(service.permissions$)).toEqual(perms);
    });

    /**
     * Verifies: hasPermission is true only for a permission the user holds.
     * Interacts with: permissions$.
     * Data: the user holds ViewProjects only.
     */
    it('grants a held permission and denies the rest', async () => {
      const { service } = await loaded({
        system: [SystemPermission.ViewProjects],
      });

      expect(
        await current(service.hasPermission(SystemPermission.ViewProjects)),
      ).toBe(true);
      expect(
        await current(service.hasPermission(SystemPermission.ManageProjects)),
      ).toBe(false);
    });
  });

  describe('canViewAdiminstration()', () => {
    /**
     * Verifies: any system permission that starts with "View" grants the administration area.
     * Interacts with: permissions$, groupPermissions$.
     * Data: one View* permission per row (including ViewVLANs).
     */
    it.each(viewPermissions)('is true with %s', async (permission) => {
      const { service } = await loaded({ system: [permission] });

      expect(await current(service.canViewAdiminstration())).toBe(true);
    });

    /**
     * Verifies: system permissions that don't start with "View" don't grant the administration area on their own.
     * Interacts with: permissions$, groupPermissions$.
     * Data: every non-View system permission at once (CreateProjects, ManageUsers, ...), no group claims.
     */
    it('is false with only non-View system permissions', async () => {
      const { service } = await loaded({ system: nonViewPermissions });

      // canViewAdiminstration is a prefix match on "View", so a system role
      // reaches the admin area only through a View* permission. The seeded
      // Administrator role is expanded to every permission by the API
      // (UserClaimsService.cs:189-192), and Observer holds every View*.
      expect(await current(service.canViewAdiminstration())).toBe(false);
    });

    /**
     * Verifies: a ManageMembership claim on any group grants the administration area without system permissions.
     * Interacts with: GroupPermissionsService.getMyGroupPermissions (stub), groupPermissions$.
     * Data: no system permissions; a ManageMembership claim on g1.
     */
    it('is true for a group manager without system permissions', async () => {
      const { service } = await loaded({
        group: [groupClaim('g1', GroupPermission.ManageMembership)],
      });

      expect(await current(service.canViewAdiminstration())).toBe(true);
    });

    /**
     * Verifies: an EditGroup-only claim does not grant the administration area.
     * Interacts with: groupPermissions$.
     * Data: no system permissions; an EditGroup claim on g1.
     */
    it('is false with only an EditGroup claim', async () => {
      const { service } = await loaded({
        group: [groupClaim('g1', GroupPermission.EditGroup)],
      });

      expect(await current(service.canViewAdiminstration())).toBe(false);
    });
  });

  describe('canViewGroupsAdmin()', () => {
    /**
     * Verifies: ViewGroups, or a ManageMembership claim, grants the groups admin page; other permissions and EditGroup claims don't.
     * Interacts with: permissions$, groupPermissions$.
     * Data: one row per combination of system permissions and group claims.
     */
    it.each([
      {
        name: 'ViewGroups',
        system: [SystemPermission.ViewGroups],
        group: [],
        expected: true,
      },
      {
        name: 'a ManageMembership claim',
        system: [],
        group: [groupClaim('g1', GroupPermission.ManageMembership)],
        expected: true,
      },
      {
        name: 'other View permissions only',
        system: viewPermissions.filter(
          (p) => p !== SystemPermission.ViewGroups,
        ),
        group: [],
        expected: false,
      },
      {
        name: 'ManageGroups without ViewGroups',
        system: [SystemPermission.ManageGroups],
        group: [],
        expected: false,
      },
      {
        name: 'an EditGroup claim only',
        system: [],
        group: [groupClaim('g1', GroupPermission.EditGroup)],
        expected: false,
      },
    ])('is $expected with $name', async ({ system, group, expected }) => {
      const { service } = await loaded({ system, group });

      expect(await current(service.canViewGroupsAdmin())).toBe(expected);
    });
  });

  describe('project checks', () => {
    const projectChecks = [
      {
        check: 'canEditProject' as const,
        system: SystemPermission.EditProjects,
        scoped: ProjectPermission.EditProject,
      },
      {
        check: 'canManageProject' as const,
        system: SystemPermission.ManageProjects,
        scoped: ProjectPermission.ManageProject,
      },
      {
        check: 'canAdminLockProject' as const,
        system: SystemPermission.LockFiles,
        scoped: ProjectPermission.LockFiles,
      },
    ];

    describe.each(projectChecks)('$check', ({ check, system, scoped }) => {
      /**
       * Verifies: the system permission grants the check for any project, with no project claims at all.
       * Interacts with: permissions$, projectPermissions$.
       * Data: the system permission for this row; no claims; project id 'any'.
       */
      it(`is true for any project with system ${system}`, async () => {
        const { service } = await loaded({ system: [system] });

        expect(await current(service[check]('any'))).toBe(true);
      });

      /**
       * Verifies: a claim on the same project carrying the scoped permission grants the check.
       * Interacts with: ProjectPermissionsService.getMyProjectPermissions (stub), projectPermissions$.
       * Data: no system permissions; a claim on p1 with this row's scoped permission.
       */
      it(`is true on a project where the user holds ${scoped}`, async () => {
        const { service } = await loaded({
          project: [projectClaim('p1', scoped)],
        });

        expect(await current(service[check]('p1'))).toBe(true);
      });

      /**
       * Verifies: a claim on another project does not grant the check.
       * Interacts with: projectPermissions$.
       * Data: a claim on p2 with the scoped permission; the check asks about p1.
       */
      it(`is false when ${scoped} is held on another project`, async () => {
        const { service } = await loaded({
          project: [projectClaim('p2', scoped)],
        });

        expect(await current(service[check]('p1'))).toBe(false);
      });

      /**
       * Verifies: with no project id (as before a route parameter resolves), project claims are ignored.
       * Interacts with: projectPermissions$.
       * Data: a claim on p1 with the scoped permission; the check is called with null and with undefined.
       */
      it('ignores project claims when the project id is missing', async () => {
        const { service } = await loaded({
          project: [projectClaim('p1', scoped)],
        });

        expect(await current(service[check](null))).toBe(false);
        expect(await current(service[check](undefined))).toBe(false);
      });

      /**
       * Verifies: with no project id, the system permission still grants the check.
       * Interacts with: permissions$.
       * Data: the system permission for this row; the check is called with null.
       */
      it(`is true without a project id with system ${system}`, async () => {
        const { service } = await loaded({ system: [system] });

        expect(await current(service[check](null))).toBe(true);
      });

      /**
       * Verifies: a claim on the project with every other scoped permission does not grant the check.
       * Interacts with: projectPermissions$.
       * Data: a claim on p1 with all ProjectPermission values except this row's.
       */
      it(`is false on a project where the user lacks ${scoped}`, async () => {
        const others = Object.values(ProjectPermission).filter(
          (p) => p !== scoped,
        );
        const { service } = await loaded({
          project: [projectClaim('p1', ...others)],
        });

        // NOTE: scoped permissions aren't hierarchical: a ManageProject claim
        // doesn't imply EditProject. That matches caster.api, which expands a
        // role's AllPermissions (UserClaimsService.cs:232-234) and checks each
        // pair exactly (e.g. Files/Requests/Lock.cs:35).
        expect(await current(service[check]('p1'))).toBe(false);
      });

      /**
       * Verifies: system permissions other than this row's don't grant the check.
       * Interacts with: permissions$.
       * Data: every system permission except this row's; no claims.
       */
      it(`is false with every system permission except ${system}`, async () => {
        const { service } = await loaded({
          system: allSystemPermissions.filter((p) => p !== system),
        });

        expect(await current(service[check]('p1'))).toBe(false);
      });
    });

    /**
     * Verifies: loadProjectPermissions passes the project id to the API, or undefined to load every project's claims.
     * Interacts with: ProjectPermissionsService.getMyProjectPermissions (stub).
     * Data: one call with 'p1', one with no argument.
     */
    it('passes the project id (or undefined) to the API', async () => {
      const { service, projectApi } = setup();

      await firstValueFrom(service.loadProjectPermissions('p1'));
      await firstValueFrom(service.loadProjectPermissions());

      expect(projectApi.getMyProjectPermissions.mock.calls).toEqual([
        ['p1'],
        [undefined],
      ]);
    });

    /**
     * Verifies: each loadProjectPermissions replaces the stored claims instead of merging them.
     * Interacts with: ProjectPermissionsService.getMyProjectPermissions (stub), projectPermissions$.
     * Data: the first load returns an EditProject claim on p1; the second (scoped to p2) returns a claim on p2 only.
     */
    it('replaces earlier claims on every load', async () => {
      const { service, projectApi } = setup();
      const canEditP1 = recordEmissions(service.canEditProject('p1'));
      projectApi.getMyProjectPermissions.mockReturnValueOnce(
        of([projectClaim('p1', ProjectPermission.EditProject)]),
      );
      projectApi.getMyProjectPermissions.mockReturnValueOnce(
        of([projectClaim('p2', ProjectPermission.EditProject)]),
      );

      await firstValueFrom(service.loadProjectPermissions());
      await firstValueFrom(service.loadProjectPermissions('p2'));

      // Each load replaces the cached claims: after loading one project's
      // claims (project-memberships page, collapse container) only that
      // project's are held, and the project list page reloads them all.
      expect(canEditP1).toEqual([false, true, false]);
      expect(await firstValueFrom(service.projectPermissions$)).toEqual([
        projectClaim('p2', ProjectPermission.EditProject),
      ]);
    });

    /**
     * Verifies: a claim whose permissions are null makes the check's stream error instead of returning false.
     * Interacts with: projectPermissions$.
     * Data: a claim on p1 with permissions null (the generated type allows it).
     */
    it('errors on a matching claim with null permissions', async () => {
      const { service } = await loaded({
        project: [{ projectId: 'p1', permissions: null }],
      });

      // NOTE: the generated type allows null, but caster.api's claim
      // defaults Permissions to [] (ProjectPermissionClaim.cs:15), so this
      // can't happen against the real API today.
      await expect(current(service.canEditProject('p1'))).rejects.toThrow(
        TypeError,
      );
    });
  });

  describe('group checks', () => {
    const groupChecks = [
      {
        check: 'canManageGroup' as const,
        scoped: GroupPermission.ManageMembership,
      },
      { check: 'canEditGroup' as const, scoped: GroupPermission.EditGroup },
    ];

    describe.each(groupChecks)('$check', ({ check, scoped }) => {
      /**
       * Verifies: the ManageGroups system permission grants the check for any group.
       * Interacts with: permissions$, groupPermissions$.
       * Data: [ManageGroups]; no claims; group id 'any'.
       */
      it('is true for any group with system ManageGroups', async () => {
        const { service } = await loaded({
          system: [SystemPermission.ManageGroups],
        });

        expect(await current(service[check]('any'))).toBe(true);
      });

      /**
       * Verifies: ViewGroups does not grant the check.
       * Interacts with: permissions$.
       * Data: [ViewGroups]; no claims.
       */
      it('is false with only ViewGroups', async () => {
        const { service } = await loaded({
          system: [SystemPermission.ViewGroups],
        });

        expect(await current(service[check]('g1'))).toBe(false);
      });

      /**
       * Verifies: a claim on the same group carrying the scoped permission grants the check.
       * Interacts with: GroupPermissionsService.getMyGroupPermissions (stub), groupPermissions$.
       * Data: no system permissions; a claim on g1 with this row's scoped permission.
       */
      it(`is true on a group where the user holds ${scoped}`, async () => {
        const { service } = await loaded({ group: [groupClaim('g1', scoped)] });

        expect(await current(service[check]('g1'))).toBe(true);
      });

      /**
       * Verifies: with no group id, group claims are ignored.
       * Interacts with: groupPermissions$.
       * Data: a claim on g1 with the scoped permission; the check is called with null and with undefined.
       */
      it('ignores group claims when the group id is missing', async () => {
        const { service } = await loaded({ group: [groupClaim('g1', scoped)] });

        expect(await current(service[check](null))).toBe(false);
        expect(await current(service[check](undefined))).toBe(false);
      });

      /**
       * Verifies: with no group id, ManageGroups still grants the check.
       * Interacts with: permissions$.
       * Data: [ManageGroups]; the check is called with null.
       */
      it('is true without a group id with system ManageGroups', async () => {
        const { service } = await loaded({
          system: [SystemPermission.ManageGroups],
        });

        expect(await current(service[check](null))).toBe(true);
      });

      /**
       * Verifies: the scoped permission on another group, or the other scoped permission on this group, does not grant the check.
       * Interacts with: groupPermissions$.
       * Data: a claim on g2 with this row's permission, and a claim on g1 with the other group permission.
       */
      it(`is false without ${scoped} on that group`, async () => {
        const other = Object.values(GroupPermission).filter(
          (p) => p !== scoped,
        );
        const { service } = await loaded({
          group: [groupClaim('g2', scoped), groupClaim('g1', ...other)],
        });

        expect(await current(service[check]('g1'))).toBe(false);
      });
    });
  });

  describe('loadGroupPermissions()', () => {
    /**
     * Verifies: concurrent and repeated callers share one request and one subscription to it.
     * Interacts with: GroupPermissionsService.getMyGroupPermissions (stub, cold observable counting subscriptions).
     * Data: two loadGroupPermissions() calls, each subscribed, plus a later third call.
     */
    it('shares one request between callers', async () => {
      const { service, groupApi } = setup();
      let subscriptions = 0;
      const claims = [groupClaim('g1', GroupPermission.EditGroup)];
      groupApi.getMyGroupPermissions.mockReturnValue(
        defer(() => {
          subscriptions++;
          return of(claims);
        }),
      );

      const first = service.loadGroupPermissions();
      const second = service.loadGroupPermissions();
      expect(second).toBe(first);
      expect(await firstValueFrom(first)).toEqual(claims);
      expect(await firstValueFrom(second)).toEqual(claims);
      expect(await firstValueFrom(service.loadGroupPermissions())).toEqual(
        claims,
      );

      expect(groupApi.getMyGroupPermissions).toHaveBeenCalledTimes(1);
      expect(groupApi.getMyGroupPermissions).toHaveBeenCalledWith();
      expect(subscriptions).toBe(1);
    });

    /**
     * Verifies: forceReload fetches again and the new claims replace the old ones.
     * Interacts with: GroupPermissionsService.getMyGroupPermissions (stub), groupPermissions$.
     * Data: the first load grants ManageMembership on g1; the forced reload returns no claims (a self-demotion).
     */
    it('refetches and replaces the claims on forceReload', async () => {
      const { service, groupApi } = setup();
      groupApi.getMyGroupPermissions.mockReturnValueOnce(
        of([groupClaim('g1', GroupPermission.ManageMembership)]),
      );
      groupApi.getMyGroupPermissions.mockReturnValueOnce(of([]));
      const canManage = recordEmissions(service.canManageGroup('g1'));

      await firstValueFrom(service.loadGroupPermissions());
      await firstValueFrom(service.loadGroupPermissions(true));

      expect(groupApi.getMyGroupPermissions).toHaveBeenCalledTimes(2);
      expect(canManage).toEqual([false, true, false]);
    });

    /**
     * Verifies: a failed request is passed to the subscriber and cleared from the cache, so the next call retries.
     * Interacts with: GroupPermissionsService.getMyGroupPermissions (stub erroring once, then succeeding).
     * Data: the first request errors with Error('503'); the retry returns a claim on g1.
     */
    it('clears the cache after a failure so the next call retries', async () => {
      const { service, groupApi } = setup();
      const unavailable = new Error('503');
      groupApi.getMyGroupPermissions.mockReturnValueOnce(
        throwError(() => unavailable),
      );
      const claims = [groupClaim('g1', GroupPermission.EditGroup)];
      groupApi.getMyGroupPermissions.mockReturnValueOnce(of(claims));

      await expect(firstValueFrom(service.loadGroupPermissions())).rejects.toBe(
        unavailable,
      );
      expect(await firstValueFrom(service.loadGroupPermissions())).toEqual(
        claims,
      );

      expect(groupApi.getMyGroupPermissions).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: an older request that fails after a forced reload succeeded clears the newer cache, so the next call fetches again.
     * Interacts with: GroupPermissionsService.getMyGroupPermissions (stub returning controllable Subjects).
     * Data: request 1 is pending when forceReload starts request 2; request 2 succeeds, then request 1 errors.
     */
    it('lets a stale failure clear a newer cached result', async () => {
      const { service, groupApi } = setup();
      const stale = new Subject<GroupPermissionsClaim[]>();
      const fresh = new Subject<GroupPermissionsClaim[]>();
      groupApi.getMyGroupPermissions.mockReturnValueOnce(stale);
      groupApi.getMyGroupPermissions.mockReturnValueOnce(fresh);
      groupApi.getMyGroupPermissions.mockReturnValueOnce(of([]));
      const staleError = vi.fn();

      service.loadGroupPermissions().subscribe({ error: staleError });
      const reloaded = firstValueFrom(service.loadGroupPermissions(true));
      fresh.next([groupClaim('g1', GroupPermission.EditGroup)]);
      fresh.complete();
      await reloaded;
      stale.error(new Error('timeout'));

      expect(staleError).toHaveBeenCalledTimes(1);
      service.loadGroupPermissions().subscribe();

      expect(groupApi.getMyGroupPermissions).toHaveBeenCalledTimes(3);
    });
  });
});
