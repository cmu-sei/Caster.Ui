// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { AdminContainerComponent } from './admin-app/component/admin-container/admin-container.component';
import { ProjectListContainerComponent } from './project/component/project-home/project-list-container/project-list-container.component';

const routes: Routes = [
  {
    path: 'admin',
    component: AdminContainerComponent,
    pathMatch: 'full',
    canActivate: [ComnAuthGuardService],
  },
  {
    path: '',
    component: ProjectListContainerComponent,
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
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
