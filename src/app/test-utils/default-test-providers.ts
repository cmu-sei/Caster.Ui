// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { EMPTY, of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
  CrucibleDialogService,
  CrucibleThemeService,
} from '@cmusei/crucible-common';
import { AnyProvider, mergeProviders, unstubbed } from './unstubbed';

// 1. App services that components inject. Feature `state/` services, stores
//    and queries, and the BehaviorSubject-backed GroupService, RoleService and
//    membership services, stay REAL. PermissionService is not listed either:
//    it stays real, and gate tests prime it with permissionDataProviders().
import { SignalRService } from '../shared/signalr/signalr.service';
import { SystemMessageService } from '../sei-cwd-common/cwd-system-message/services/system-message.service';
import { ErrorService } from '../sei-cwd-common/cwd-error/error.service';

// 2. Every generated API service under src/app/generated/caster-api.
import {
  AppliesService,
  DesignsModulesService,
  DesignsService,
  DirectoriesService,
  FilesService,
  GroupPermissionsService,
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
  VariablesService,
  VlansService,
  WorkspacesService,
} from '../generated/caster-api';

// 3. RouterQuery: caster.ui uses @datorama/akita-ng-router-store.
import { RouterQuery } from '@datorama/akita-ng-router-store';

export function getDefaultProviders(
  overrides?: readonly AnyProvider[],
): AnyProvider[] {
  const defaults: AnyProvider[] = [
    // App services
    // Never let a component under test open a real hub connection.
    unstubbed(SignalRService),
    unstubbed(SystemMessageService),
    { provide: ErrorService, useValue: { handleError: () => {} } },

    // Generated API services: one `unstubbed(...)` per service. A test that
    // needs an endpoint passes `{ provide: XService, useValue: xApi }` built
    // with `satisfies ApiStub<XService>`.
    unstubbed(AppliesService),
    unstubbed(DesignsModulesService),
    unstubbed(DesignsService),
    unstubbed(DirectoriesService),
    unstubbed(FilesService),
    unstubbed(GroupPermissionsService),
    unstubbed(GroupsService),
    unstubbed(HealthService),
    unstubbed(HostsService),
    unstubbed(ModulesService),
    unstubbed(PlansService),
    unstubbed(ProjectPermissionsService),
    unstubbed(ProjectRolesService),
    unstubbed(ProjectsService),
    unstubbed(ResourcesService),
    unstubbed(RunsService),
    unstubbed(SystemPermissionsService),
    unstubbed(SystemRolesService),
    unstubbed(TerraformService),
    unstubbed(UsersService),
    unstubbed(VariablesService),
    unstubbed(VlansService),
    unstubbed(WorkspacesService),

    // Akita router
    {
      provide: RouterQuery,
      useValue: {
        selectQueryParams: () => of(null),
        select: () => of(null),
      },
    },

    // Common library
    {
      provide: ComnSettingsService,
      useValue: {
        settings: {
          ApiUrl: '',
          AppTopBarText: 'Caster',
          AppTopBarHexColor: '#E9831C',
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
    {
      provide: ComnAuthQuery,
      useValue: {
        userTheme$: of('light-theme'),
        isLoggedIn$: of(true),
      },
    },
    // Confirmation dialogs (editor, variables, design modules, workspaces).
    unstubbed(CrucibleDialogService),
    // Theme switching (app.component); never let a spec write the real theme.
    unstubbed(CrucibleThemeService),

    // Dialog tokens
    { provide: MAT_DIALOG_DATA, useValue: {} },
    {
      provide: MatDialogRef,
      useValue: {
        close: () => {},
        beforeClosed: () => EMPTY,
        afterClosed: () => EMPTY,
        keydownEvents: () => EMPTY,
      },
    },

    // Router
    {
      provide: ActivatedRoute,
      useValue: {
        params: of({}),
        paramMap: of(convertToParamMap({})),
        queryParams: of({}),
        queryParamMap: of(convertToParamMap({})),
        snapshot: {
          params: {},
          paramMap: convertToParamMap({}),
          queryParams: {},
          queryParamMap: convertToParamMap({}),
        },
      },
    },
  ];

  return mergeProviders(defaults, overrides);
}
