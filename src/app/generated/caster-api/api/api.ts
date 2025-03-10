/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

export * from './applies.service';
import { AppliesService } from './applies.service';
export * from './designs.service';
import { DesignsService } from './designs.service';
export * from './designsModules.service';
import { DesignsModulesService } from './designsModules.service';
export * from './directories.service';
import { DirectoriesService } from './directories.service';
export * from './files.service';
import { FilesService } from './files.service';
export * from './groups.service';
import { GroupsService } from './groups.service';
export * from './health.service';
import { HealthService } from './health.service';
export * from './hosts.service';
import { HostsService } from './hosts.service';
export * from './modules.service';
import { ModulesService } from './modules.service';
export * from './plans.service';
import { PlansService } from './plans.service';
export * from './projectPermissions.service';
import { ProjectPermissionsService } from './projectPermissions.service';
export * from './projectRoles.service';
import { ProjectRolesService } from './projectRoles.service';
export * from './projects.service';
import { ProjectsService } from './projects.service';
export * from './resources.service';
import { ResourcesService } from './resources.service';
export * from './runs.service';
import { RunsService } from './runs.service';
export * from './systemPermissions.service';
import { SystemPermissionsService } from './systemPermissions.service';
export * from './systemRoles.service';
import { SystemRolesService } from './systemRoles.service';
export * from './terraform.service';
import { TerraformService } from './terraform.service';
export * from './users.service';
import { UsersService } from './users.service';
export * from './variables.service';
import { VariablesService } from './variables.service';
export * from './vlans.service';
import { VlansService } from './vlans.service';
export * from './workspaces.service';
import { WorkspacesService } from './workspaces.service';
export const APIS = [AppliesService, DesignsService, DesignsModulesService, DirectoriesService, FilesService, GroupsService, HealthService, HostsService, ModulesService, PlansService, ProjectPermissionsService, ProjectRolesService, ProjectsService, ResourcesService, RunsService, SystemPermissionsService, SystemRolesService, TerraformService, UsersService, VariablesService, VlansService, WorkspacesService];
