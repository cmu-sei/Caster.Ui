/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

export * from './applies.service';
import { AppliesService } from './applies.service';
export * from './directories.service';
import { DirectoriesService } from './directories.service';
export * from './files.service';
import { FilesService } from './files.service';
export * from './health.service';
import { HealthService } from './health.service';
export * from './hosts.service';
import { HostsService } from './hosts.service';
export * from './modules.service';
import { ModulesService } from './modules.service';
export * from './permissions.service';
import { PermissionsService } from './permissions.service';
export * from './plans.service';
import { PlansService } from './plans.service';
export * from './projects.service';
import { ProjectsService } from './projects.service';
export * from './resources.service';
import { ResourcesService } from './resources.service';
export * from './runs.service';
import { RunsService } from './runs.service';
export * from './terraform.service';
import { TerraformService } from './terraform.service';
export * from './userPermissions.service';
import { UserPermissionsService } from './userPermissions.service';
export * from './users.service';
import { UsersService } from './users.service';
export * from './workspaces.service';
import { WorkspacesService } from './workspaces.service';
export const APIS = [AppliesService, DirectoriesService, FilesService, HealthService, HostsService, ModulesService, PermissionsService, PlansService, ProjectsService, ResourcesService, RunsService, TerraformService, UserPermissionsService, UsersService, WorkspacesService];
