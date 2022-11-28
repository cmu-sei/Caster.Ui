/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { NgModule, ModuleWithProviders, SkipSelf, Optional } from '@angular/core';
import { Configuration } from './configuration';
import { HttpClient } from '@angular/common/http';

import { AppliesService } from './api/applies.service';
import { DesignsService } from './api/designs.service';
import { DesignsModulesService } from './api/designsModules.service';
import { DirectoriesService } from './api/directories.service';
import { FilesService } from './api/files.service';
import { HealthService } from './api/health.service';
import { HostsService } from './api/hosts.service';
import { ModulesService } from './api/modules.service';
import { PermissionsService } from './api/permissions.service';
import { PlansService } from './api/plans.service';
import { ProjectsService } from './api/projects.service';
import { ResourcesService } from './api/resources.service';
import { RunsService } from './api/runs.service';
import { TerraformService } from './api/terraform.service';
import { UserPermissionsService } from './api/userPermissions.service';
import { UsersService } from './api/users.service';
import { VariablesService } from './api/variables.service';
import { VlansService } from './api/vlans.service';
import { WorkspacesService } from './api/workspaces.service';

@NgModule({
  imports:      [],
  declarations: [],
  exports:      [],
  providers: []
})
export class ApiModule {
    public static forRoot(configurationFactory: () => Configuration): ModuleWithProviders<ApiModule> {
        return {
            ngModule: ApiModule,
            providers: [ { provide: Configuration, useFactory: configurationFactory } ]
        };
    }

    constructor( @Optional() @SkipSelf() parentModule: ApiModule,
                 @Optional() http: HttpClient) {
        if (parentModule) {
            throw new Error('ApiModule is already loaded. Import in your base AppModule only.');
        }
        if (!http) {
            throw new Error('You need to import the HttpClientModule in your AppModule! \n' +
            'See also https://github.com/angular/angular/issues/20575');
        }
    }
}
