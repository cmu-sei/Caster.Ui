// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { CanDeactivateGuard } from './sei-cwd-common/cwd-route-guards/can-deactivate.guard';
import { ProjectCollapseContainerComponent } from './project/component/project-details/project-collapse-container/project-collapse-container.component';
import { ProjectListContainerComponent } from './project/component/project-home/project-list-container/project-list-container.component';
import { ProjectMembershipsPageComponent } from './project/component/project-memberships/project-memberships-page/project-memberships-page.component';

export const routes: Routes = [
  // These came from RouterModule.forChild() in ProjectModule, which main.ts
  // imported ahead of provideRouter(), so they stay first.
  {
    path: 'projects',
    component: ProjectListContainerComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'projects/:id',
    component: ProjectCollapseContainerComponent,
    canActivate: [ComnAuthGuardService],
    canDeactivate: [CanDeactivateGuard],
  },
  {
    path: 'admin',
    pathMatch: 'full',
    loadChildren: () =>
      import('./admin-app/admin.routes').then((m) => m.ADMIN_ROUTES),
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
