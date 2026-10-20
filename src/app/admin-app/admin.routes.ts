// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/admin-container/admin-container.component').then(
        (m) => m.AdminContainerComponent,
      ),
    pathMatch: 'full',
  },
];
