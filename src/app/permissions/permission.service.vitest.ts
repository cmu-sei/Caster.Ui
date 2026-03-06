// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { PermissionService } from './permission.service';
import {
  SystemPermission,
  SystemPermissionsService,
  ProjectPermission,
  ProjectPermissionsClaim,
  ProjectPermissionsService,
} from '../generated/caster-api';

describe('PermissionService', () => {
  let service: PermissionService;
  let mockSystemPermissionsService: { getMySystemPermissions: ReturnType<typeof vi.fn> };
  let mockProjectPermissionsService: { getMyProjectPermissions: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSystemPermissionsService = {
      getMySystemPermissions: vi.fn().mockReturnValue(of([])),
    };
    mockProjectPermissionsService = {
      getMyProjectPermissions: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        { provide: SystemPermissionsService, useValue: mockSystemPermissionsService },
        { provide: ProjectPermissionsService, useValue: mockProjectPermissionsService },
      ],
    });

    service = TestBed.inject(PermissionService);
  });

  // ---- load() ----
  describe('load()', () => {
    it('should call getMySystemPermissions and expose permissions via permissions$', async () => {
      const perms: SystemPermission[] = [SystemPermission.ViewProjects, SystemPermission.ManageUsers];
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(perms));

      await firstValueFrom(service.load());

      const result = await firstValueFrom(service.permissions$);
      expect(result).toEqual(perms);
      expect(mockSystemPermissionsService.getMySystemPermissions).toHaveBeenCalledOnce();
    });

    it('should start with empty permissions', async () => {
      const result = await firstValueFrom(service.permissions$);
      expect(result).toEqual([]);
    });
  });

  // ---- hasPermission() ----
  describe('hasPermission()', () => {
    const allSystemPermissions = Object.values(SystemPermission) as SystemPermission[];

    it('should return false for all permissions when none are loaded', async () => {
      for (const perm of allSystemPermissions) {
        const result = await firstValueFrom(service.hasPermission(perm));
        expect(result).toBe(false);
      }
    });

    // Test each SystemPermission individually
    for (const perm of Object.values(SystemPermission) as SystemPermission[]) {
      it(`should return true when user has ${perm}`, async () => {
        mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([perm]));
        await firstValueFrom(service.load());

        const result = await firstValueFrom(service.hasPermission(perm));
        expect(result).toBe(true);
      });

      it(`should return false for ${perm} when user has other permissions`, async () => {
        const otherPerms = allSystemPermissions.filter((p) => p !== perm);
        // Load only "other" permissions (everything except this one)
        if (otherPerms.length > 0) {
          mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([otherPerms[0]]));
          await firstValueFrom(service.load());

          const result = await firstValueFrom(service.hasPermission(perm));
          expect(result).toBe(false);
        }
      });
    }

    it('should return true when user has all permissions', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of(allSystemPermissions));
      await firstValueFrom(service.load());

      for (const perm of allSystemPermissions) {
        const result = await firstValueFrom(service.hasPermission(perm));
        expect(result).toBe(true);
      }
    });
  });

  // ---- canViewAdiminstration() ----
  describe('canViewAdiminstration()', () => {
    const viewPermissions: SystemPermission[] = [
      SystemPermission.ViewProjects,
      SystemPermission.ViewUsers,
      SystemPermission.ViewWorkspaces,
      SystemPermission.ViewVlans,
      SystemPermission.ViewRoles,
      SystemPermission.ViewGroups,
      SystemPermission.ViewHosts,
      SystemPermission.ViewModules,
    ];

    it('should return false with no permissions', async () => {
      const result = await firstValueFrom(service.canViewAdiminstration());
      expect(result).toBe(false);
    });

    for (const viewPerm of viewPermissions) {
      it(`should return true with ${viewPerm}`, async () => {
        mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([viewPerm]));
        await firstValueFrom(service.load());

        const result = await firstValueFrom(service.canViewAdiminstration());
        expect(result).toBe(true);
      });
    }

    it('should return false with only non-View permissions', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ManageUsers, SystemPermission.EditProjects, SystemPermission.LockFiles])
      );
      await firstValueFrom(service.load());

      const result = await firstValueFrom(service.canViewAdiminstration());
      expect(result).toBe(false);
    });

    it('should return true with mixed View and non-View permissions', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ManageUsers, SystemPermission.ViewProjects])
      );
      await firstValueFrom(service.load());

      const result = await firstValueFrom(service.canViewAdiminstration());
      expect(result).toBe(true);
    });
  });

  // ---- canEditProject() ----
  describe('canEditProject()', () => {
    const projectId = 'proj-123';

    it('should return true with system-level EditProjects', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.EditProjects])
      );
      await firstValueFrom(service.load());

      const result = await firstValueFrom(service.canEditProject(projectId));
      expect(result).toBe(true);
    });

    it('should return true with project-level EditProject', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId, permissions: [ProjectPermission.EditProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions(projectId));

      const result = await firstValueFrom(service.canEditProject(projectId));
      expect(result).toBe(true);
    });

    it('should return false without any edit permission', async () => {
      const result = await firstValueFrom(service.canEditProject(projectId));
      expect(result).toBe(false);
    });

    it('should return false with project-level EditProject for a different project', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'other-project', permissions: [ProjectPermission.EditProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions(projectId));

      const result = await firstValueFrom(service.canEditProject(projectId));
      expect(result).toBe(false);
    });
  });

  // ---- canManageProject() ----
  describe('canManageProject()', () => {
    const projectId = 'proj-456';

    it('should return true with system-level ManageProjects', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ManageProjects])
      );
      await firstValueFrom(service.load());

      const result = await firstValueFrom(service.canManageProject(projectId));
      expect(result).toBe(true);
    });

    it('should return true with project-level ManageProject', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId, permissions: [ProjectPermission.ManageProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions(projectId));

      const result = await firstValueFrom(service.canManageProject(projectId));
      expect(result).toBe(true);
    });

    it('should return false without any manage permission', async () => {
      const result = await firstValueFrom(service.canManageProject(projectId));
      expect(result).toBe(false);
    });

    it('should return false with project-level ManageProject for a different project', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'other-project', permissions: [ProjectPermission.ManageProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions(projectId));

      const result = await firstValueFrom(service.canManageProject(projectId));
      expect(result).toBe(false);
    });
  });

  // ---- canAdminLockProject() ----
  describe('canAdminLockProject()', () => {
    const projectId = 'proj-789';

    it('should return true with system-level LockFiles', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.LockFiles])
      );
      await firstValueFrom(service.load());

      const result = await firstValueFrom(service.canAdminLockProject(projectId));
      expect(result).toBe(true);
    });

    it('should return true with project-level LockFiles', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId, permissions: [ProjectPermission.LockFiles] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions(projectId));

      const result = await firstValueFrom(service.canAdminLockProject(projectId));
      expect(result).toBe(true);
    });

    it('should return false without any lock permission', async () => {
      const result = await firstValueFrom(service.canAdminLockProject(projectId));
      expect(result).toBe(false);
    });

    it('should return false with project-level LockFiles for a different project', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'other-project', permissions: [ProjectPermission.LockFiles] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions(projectId));

      const result = await firstValueFrom(service.canAdminLockProject(projectId));
      expect(result).toBe(false);
    });
  });

  // ---- Permission hierarchy ----
  describe('Permission hierarchy', () => {
    const projectId = 'proj-hierarchy';

    it('system-level EditProjects overrides project-level (no project perm needed)', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.EditProjects])
      );
      await firstValueFrom(service.load());

      // No project permissions loaded at all
      const result = await firstValueFrom(service.canEditProject(projectId));
      expect(result).toBe(true);
    });

    it('system-level ManageProjects overrides project-level', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.ManageProjects])
      );
      await firstValueFrom(service.load());

      const result = await firstValueFrom(service.canManageProject(projectId));
      expect(result).toBe(true);
    });

    it('project-level permission works alone without system permission', async () => {
      // No system permissions
      const claims: ProjectPermissionsClaim[] = [
        { projectId, permissions: [ProjectPermission.EditProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions(projectId));

      const result = await firstValueFrom(service.canEditProject(projectId));
      expect(result).toBe(true);
    });

    it('wrong project returns false even with project permission', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'wrong-project', permissions: [ProjectPermission.EditProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions());

      const result = await firstValueFrom(service.canEditProject(projectId));
      expect(result).toBe(false);
    });

    it('system permission grants access to any project', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.EditProjects])
      );
      await firstValueFrom(service.load());

      const result1 = await firstValueFrom(service.canEditProject('project-a'));
      const result2 = await firstValueFrom(service.canEditProject('project-b'));
      const result3 = await firstValueFrom(service.canEditProject('project-c'));
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('project permission only grants access to that specific project', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'project-a', permissions: [ProjectPermission.EditProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions());

      const resultA = await firstValueFrom(service.canEditProject('project-a'));
      const resultB = await firstValueFrom(service.canEditProject('project-b'));
      expect(resultA).toBe(true);
      expect(resultB).toBe(false);
    });
  });

  // ---- Edge cases ----
  describe('Edge cases', () => {
    it('empty permissions returns false for all checks', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(of([]));
      await firstValueFrom(service.load());

      const hasAny = await firstValueFrom(service.hasPermission(SystemPermission.ViewProjects));
      const canView = await firstValueFrom(service.canViewAdiminstration());
      const canEdit = await firstValueFrom(service.canEditProject('any-id'));
      const canManage = await firstValueFrom(service.canManageProject('any-id'));
      const canLock = await firstValueFrom(service.canAdminLockProject('any-id'));

      expect(hasAny).toBe(false);
      expect(canView).toBe(false);
      expect(canEdit).toBe(false);
      expect(canManage).toBe(false);
      expect(canLock).toBe(false);
    });

    it('multiple permissions combined work correctly', async () => {
      mockSystemPermissionsService.getMySystemPermissions.mockReturnValue(
        of([SystemPermission.EditProjects, SystemPermission.ViewProjects, SystemPermission.ManageUsers])
      );
      await firstValueFrom(service.load());

      expect(await firstValueFrom(service.hasPermission(SystemPermission.EditProjects))).toBe(true);
      expect(await firstValueFrom(service.hasPermission(SystemPermission.ViewProjects))).toBe(true);
      expect(await firstValueFrom(service.hasPermission(SystemPermission.ManageUsers))).toBe(true);
      expect(await firstValueFrom(service.hasPermission(SystemPermission.ManageProjects))).toBe(false);
      expect(await firstValueFrom(service.canViewAdiminstration())).toBe(true);
      expect(await firstValueFrom(service.canEditProject('any'))).toBe(true);
      expect(await firstValueFrom(service.canManageProject('any'))).toBe(false);
    });

    it('multiple project permission claims for different projects', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'proj-1', permissions: [ProjectPermission.EditProject] },
        { projectId: 'proj-2', permissions: [ProjectPermission.ManageProject] },
        { projectId: 'proj-3', permissions: [ProjectPermission.LockFiles] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions());

      expect(await firstValueFrom(service.canEditProject('proj-1'))).toBe(true);
      expect(await firstValueFrom(service.canEditProject('proj-2'))).toBe(false);
      expect(await firstValueFrom(service.canManageProject('proj-2'))).toBe(true);
      expect(await firstValueFrom(service.canManageProject('proj-1'))).toBe(false);
      expect(await firstValueFrom(service.canAdminLockProject('proj-3'))).toBe(true);
      expect(await firstValueFrom(service.canAdminLockProject('proj-1'))).toBe(false);
    });

    it('project claim with empty permissions array returns false', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'proj-empty', permissions: [] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions());

      expect(await firstValueFrom(service.canEditProject('proj-empty'))).toBe(false);
      expect(await firstValueFrom(service.canManageProject('proj-empty'))).toBe(false);
      expect(await firstValueFrom(service.canAdminLockProject('proj-empty'))).toBe(false);
    });

    it('loadProjectPermissions passes projectId to API service', async () => {
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of([]));
      await firstValueFrom(service.loadProjectPermissions('specific-id'));

      expect(mockProjectPermissionsService.getMyProjectPermissions).toHaveBeenCalledWith('specific-id');
    });

    it('loadProjectPermissions updates projectPermissions$ observable', async () => {
      const claims: ProjectPermissionsClaim[] = [
        { projectId: 'proj-x', permissions: [ProjectPermission.EditProject] },
      ];
      mockProjectPermissionsService.getMyProjectPermissions.mockReturnValue(of(claims));
      await firstValueFrom(service.loadProjectPermissions());

      const result = await firstValueFrom(service.projectPermissions$);
      expect(result).toEqual(claims);
    });
  });
});
