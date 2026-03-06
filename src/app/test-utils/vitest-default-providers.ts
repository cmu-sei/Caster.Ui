// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Provider } from '@angular/core';
import { of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { ActivatedRoute } from '@angular/router';

// Akita Stores
import { UserStore } from '../users/state/user.store';
import { ModuleStore } from '../modules/state/module.store';
import { WorkspaceStore } from '../workspace/state/workspace.store';
import { DirectoryStore } from '../directories/state/directory.store';
import { VlanStore } from '../vlans/state/vlan/vlan.store';
import { PoolStore } from '../vlans/state/pool/pool.store';
import { PartitionStore } from '../vlans/state/partition/partition.store';
import { VariablesStore } from '../designs/state/variables/variables.store';
import { DesignStore } from '../designs/state/design.store';
import { DesignModuleStore } from '../designs/state/design-modules/design-module.store';
import { FileVersionStore } from '../fileVersions/state/fileVersion.store';
import { FileStore } from '../files/state/file.store';

// Akita Queries
import {
  UserQuery,
  CurrentUserQuery,
} from '../users/state/user.query';
import { ModuleQuery } from '../modules/state/module.query';
import { WorkspaceQuery } from '../workspace/state/workspace.query';
import { DirectoryQuery } from '../directories/state/directory.query';
import { VlanQuery } from '../vlans/state/vlan/vlan.query';
import { PoolQuery } from '../vlans/state/pool/pool.query';
import { PartitionQuery } from '../vlans/state/partition/partition.query';
import { VariablesQuery } from '../designs/state/variables/variables.query';
import { DesignQuery } from '../designs/state/design.query';
import { DesignModuleQuery } from '../designs/state/design-modules/design-module.query';
import { FileVersionQuery } from '../fileVersions/state/fileVersion.query';
import { FileQuery } from '../files/state/file.query';

// Application Services
import { UserService } from '../users/state/user.service';
import { ModuleService } from '../modules/state/module.service';
import { WorkspaceService } from '../workspace/state/workspace.service';
import { DirectoryService } from '../directories/state/directory.service';
import { VlanService } from '../vlans/state/vlan/vlan.service';
import { PoolService } from '../vlans/state/pool/pool.service';
import { PartitionService } from '../vlans/state/partition/partition.service';
import { DesignService } from '../designs/state/design.service';
import { VariableService } from '../designs/state/variables/variables.service';
import { DesignModuleService } from '../designs/state/design-modules/design-module.service';
import { FileVersionService } from '../fileVersions/state/fileVersion.service';
import { FileService } from '../files/state/file.service';
import { SignalRService } from '../shared/signalr/signalr.service';
import { DialogService } from '../dialogs/services/dialog.service';
import { ErrorService } from '../sei-cwd-common/cwd-error/error.service';
import { SystemMessageService } from '../sei-cwd-common/cwd-system-message/services/system-message.service';
import { ConfirmDialogService } from '../sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { PermissionService } from '../permissions/permission.service';
import { ProjectService } from '../project/state/project.service';
import { ProjectQuery as ProjectQueryService } from '../project/state/project-query.service';
import { ProjectStore as ProjectStoreService } from '../project/state/project-store.service';
import { ProjectRoleService } from '../project/state/project-role.service';
import { ProjectMembershipService } from '../project/state/project-membership.service';
import { RoleService as RolesServiceService } from '../roles/roles.service.service';
import { GroupService } from '../groups/group.service';
import { GroupMembershipService } from '../groups/group-membership.service';

// Generated API Services
import {
  AppliesService,
  DesignsService,
  DesignsModulesService,
  DirectoriesService,
  FilesService,
  GroupsService,
  HealthService,
  HostsService,
  ModulesService,
  PlansService,
  ProjectPermissionsService,
  ProjectRolesService,
  ProjectsService,
  ResourcesService,
  RunsService,
  SystemPermissionsService,
  SystemRolesService,
  TerraformService,
  UsersService,
  VariablesService as ApiVariablesService,
  VlansService,
  WorkspacesService,
} from '../generated/caster-api';

// Common library
import { ComnSettingsService, ComnAuthService } from '@cmusei/crucible-common';

function getProvideToken(provider: any): any {
  if (typeof provider === 'function') return provider;
  return provider?.provide;
}

export function getDefaultProviders(overrides?: Provider[]): Provider[] {
  const defaults: Provider[] = [
    // Akita Stores
    { provide: UserStore, useValue: {} },
    { provide: ModuleStore, useValue: {} },
    { provide: WorkspaceStore, useValue: {} },
    { provide: DirectoryStore, useValue: {} },
    { provide: VlanStore, useValue: {} },
    { provide: PoolStore, useValue: {} },
    { provide: PartitionStore, useValue: {} },
    { provide: VariablesStore, useValue: {} },
    { provide: DesignStore, useValue: {} },
    { provide: DesignModuleStore, useValue: {} },
    { provide: FileVersionStore, useValue: {} },
    { provide: FileStore, useValue: {} },

    // Akita Queries
    {
      provide: UserQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectLoading: () => of(false),
      },
    },
    {
      provide: CurrentUserQuery,
      useValue: {
        userTheme$: of('light-theme'),
        select: () =>
          of({ name: '', id: '', theme: 'light-theme', lastRoute: '/' }),
        getLastRoute: () => '/',
      },
    },
    {
      provide: ModuleQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectLoading: () => of(false),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: WorkspaceQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectLoading: () => of(false),
        getAll: () => [],
        getEntity: () => null,
        activeRuns$: () => of([]),
        expandedRuns$: () => of([]),
      },
    },
    {
      provide: DirectoryQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        getAll: () => [],
        getEntity: () => null,
        ui: {
          selectEntity: () => of(null),
          selectAll: () => of([]),
        },
      },
    },
    {
      provide: VlanQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectUnassignedByPoolId: () => of([]),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: PoolQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: PartitionQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectByPoolId: () => of([]),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: VariablesQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectByDesignId: () => of([]),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: DesignQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: DesignModuleQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        getByDesignId: () => of([]),
        getOutputsByDesignId: () => of([]),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: FileVersionQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        getAll: () => [],
        getEntity: () => null,
      },
    },
    {
      provide: FileQuery,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectIsSaved: () => of(true),
        getSelectedVersionId: () => of(null),
        getAll: () => [],
        getEntity: () => null,
      },
    },

    // Application Services
    {
      provide: UserService,
      useValue: {
        load: () => of([]),
        setCurrentUser: () => {},
        setUserTheme: () => {},
        setActive: () => {},
      },
    },
    {
      provide: ModuleService,
      useValue: {
        load: () => of([]),
        loadByDesignId: () => of([]),
        toggleSelected: () => {},
        setActive: () => {},
      },
    },
    {
      provide: WorkspaceService,
      useValue: {
        add: () => {},
        update: () => {},
        delete: () => {},
        setActive: () => {},
        loadRunsByWorkspaceId: () => of([]),
        loadResourcesByWorkspaceId: () => of([]),
        loadAllActiveRuns: () => {},
        loadLockingStatus: () => {},
      },
    },
    {
      provide: DirectoryService,
      useValue: {
        loadDirectories: () => of([]),
        add: () => {},
        update: () => {},
        delete: () => {},
        toggleIsExpanded: () => {},
      },
    },
    {
      provide: VlanService,
      useValue: {
        loadByPoolId: () => of([]),
        add: () => {},
        update: () => {},
        remove: () => {},
      },
    },
    {
      provide: PoolService,
      useValue: {
        load: () => of([]),
        add: () => {},
        update: () => {},
        remove: () => {},
      },
    },
    {
      provide: PartitionService,
      useValue: {
        load: () => of([]),
        loadByPoolId: () => of([]),
        add: () => {},
        update: () => {},
        remove: () => {},
      },
    },
    {
      provide: DesignService,
      useValue: { add: () => {}, update: () => {}, remove: () => {} },
    },
    { provide: VariableService, useValue: { loadByDesignId: () => {} } },
    {
      provide: DesignModuleService,
      useValue: {
        add: () => {},
        update: () => {},
        remove: () => {},
        loadByDesignId: () => of([]),
      },
    },
    {
      provide: FileVersionService,
      useValue: {
        load: () => of([]),
        toggleSelected: () => {},
        setActive: () => {},
      },
    },
    {
      provide: FileService,
      useValue: {
        loadFile: () => of({}),
        loadFilesByDirectory: () => of([]),
        setFiles: () => {},
        add: () => {},
        updateFile: () => {},
        lockFile: () => {},
        unlockFile: () => {},
        delete: () => {},
        setActive: () => {},
      },
    },
    {
      provide: SignalRService,
      useValue: {
        startConnection: () => Promise.resolve(),
        joinProject: () => {},
        leaveProject: () => {},
        joinWorkspace: () => {},
        leaveWorkspace: () => {},
      },
    },
    { provide: DialogService, useValue: { confirm: () => of(true) } },
    { provide: ErrorService, useValue: { handleError: () => {} } },
    { provide: SystemMessageService, useValue: {} },
    { provide: ConfirmDialogService, useValue: { confirm: () => of(true) } },
    {
      provide: PermissionService,
      useValue: {
        permissions$: of([]),
        projectPermissions$: of([]),
        load: () => of([]),
        loadProjectPermissions: () => of([]),
        canViewAdiminstration: () => of(false),
        hasPermission: () => of(false),
        canEditProject: () => of(false),
        canManageProject: () => of(false),
        canAdminLockProject: () => of(false),
      },
    },
    {
      provide: ProjectService,
      useValue: {
        loadProjects: () => of([]),
        loadProject: () => of({}),
        createProject: () => of({}),
        deleteProject: () => of(null),
        setSelectedTab: () => {},
        closeTab: () => {},
        openTab: () => {},
      },
    },
    {
      provide: ProjectQueryService,
      useValue: {
        selectAll: () => of([]),
        select: () => of(null),
        selectEntity: () => of(null),
        selectActive: () => of(null),
        selectLoading: () => of(false),
        getRightSidebarOpen$: () => of(false),
        getRightSidebarView$: () => of(''),
        getRightSidebarWidth: () => of(300),
        selectSelectedTab: () => of(0),
        selectOpenTabs: () => of([]),
        getEntity: () => null,
        getAll: () => [],
        getActive: () => null,
      },
    },
    { provide: ProjectStoreService, useValue: {} },
    {
      provide: ProjectRoleService,
      useValue: { projectRoles$: of([]), loadRoles: () => of([]) },
    },
    {
      provide: ProjectMembershipService,
      useValue: {
        projectMemberships$: of([]),
        loadMemberships: () => of([]),
        createMembership: () => of({}),
        deleteMembership: () => of(null),
      },
    },
    {
      provide: RolesServiceService,
      useValue: { roles$: of([]), getRoles: () => of([]) },
    },
    {
      provide: GroupService,
      useValue: { groups$: of([]), load: () => of([]) },
    },
    {
      provide: GroupMembershipService,
      useValue: { groupMemberships$: of([]), loadMemberships: () => of([]) },
    },

    // Generated API Services
    { provide: AppliesService, useValue: {} },
    { provide: DesignsService, useValue: {} },
    { provide: DesignsModulesService, useValue: {} },
    { provide: DirectoriesService, useValue: {} },
    { provide: FilesService, useValue: {} },
    { provide: GroupsService, useValue: {} },
    { provide: HealthService, useValue: {} },
    { provide: HostsService, useValue: {} },
    { provide: ModulesService, useValue: {} },
    { provide: PlansService, useValue: {} },
    { provide: ProjectPermissionsService, useValue: {} },
    { provide: ProjectRolesService, useValue: {} },
    { provide: ProjectsService, useValue: {} },
    { provide: ResourcesService, useValue: {} },
    { provide: RunsService, useValue: {} },
    { provide: SystemPermissionsService, useValue: {} },
    { provide: SystemRolesService, useValue: {} },
    {
      provide: TerraformService,
      useValue: {
        getTerraformVersions: () => of({ versions: [], defaultVersion: '' }),
        getTerraformMaxParallelism: () => of(10),
      },
    },
    { provide: UsersService, useValue: {} },
    { provide: ApiVariablesService, useValue: {} },
    { provide: VlansService, useValue: {} },
    { provide: WorkspacesService, useValue: {} },

    // Common library services
    {
      provide: ComnSettingsService,
      useValue: {
        settings: {
          ApiUrl: '',
          AppTopBarText: 'Caster',
          AppTopBarHexColor: '#0F1D47',
          AppTopBarHexTextColor: '#FFFFFF',
          Hotkeys: {},
        },
      },
    },
    {
      provide: ComnAuthService,
      useValue: {
        isAuthenticated$: of(true),
        user$: of({}),
        logout: () => {},
      },
    },

    // Dialog/BottomSheet tokens
    { provide: MAT_DIALOG_DATA, useValue: {} },
    { provide: MatDialogRef, useValue: { close: () => {} } },
    { provide: MAT_BOTTOM_SHEET_DATA, useValue: {} },
    { provide: MatBottomSheetRef, useValue: { dismiss: () => {} } },

    // Router
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({}),
        paramMap: of({ get: () => null, has: () => false }),
        queryParams: of({}),
        snapshot: {
          params: {},
          paramMap: { get: () => null, has: () => false },
        },
      },
    },
  ];

  if (!overrides?.length) return defaults;

  const overrideTokens = new Set(overrides.map(getProvideToken));
  const filtered = defaults.filter(
    (p) => !overrideTokens.has(getProvideToken(p))
  );
  return [...filtered, ...overrides];
}
