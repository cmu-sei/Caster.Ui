// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { CanDeactivateGuard } from './sei-cwd-common/cwd-route-guards/can-deactivate.guard';

export const routes: Routes = [
  // These came from RouterModule.forChild() in ProjectModule, which main.ts
  // imported ahead of provideRouter(), so they stay first.
  {
    path: 'projects',
    loadComponent: () =>
      import('./project/component/project-home/project-list-container/project-list-container.component').then(
        (m) => m.ProjectListContainerComponent,
      ),
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./project/component/project-details/project-collapse-container/project-collapse-container.component').then(
        (m) => m.ProjectCollapseContainerComponent,
      ),
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
    loadComponent: () =>
      import('./project/component/project-home/project-list-container/project-list-container.component').then(
        (m) => m.ProjectListContainerComponent,
      ),
    pathMatch: 'full',
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'projects/:id/memberships',
    loadComponent: () =>
      import('./project/component/project-memberships/project-memberships-page/project-memberships-page.component').then(
        (m) => m.ProjectMembershipsPageComponent,
      ),
    pathMatch: 'full',
    canActivate: [ComnAuthGuardService],
  },
];
