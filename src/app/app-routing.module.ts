// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { ProjectListContainerComponent } from './project/component/project-home/project-list-container/project-list-container.component';
import { ProjectMembershipsPageComponent } from './project/component/project-memberships/project-memberships-page/project-memberships-page.component';

const routes: Routes = [
  {
    path: 'admin',
    pathMatch: 'full',
    loadChildren: () =>
      import('./admin-app/admin-app.module').then((m) => m.AdminAppModule),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: '',
    component: ProjectListContainerComponent,
    pathMatch: 'full',
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'projects/:id/memberships',
    component: ProjectMembershipsPageComponent,
    pathMatch: 'full',
    canActivate: [ComnAuthGuardService],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      paramsInheritanceStrategy: 'always',
      onSameUrlNavigation: 'reload',
      relativeLinkResolution: 'legacy',
      preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
