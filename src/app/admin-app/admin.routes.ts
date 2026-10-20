// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { importProvidersFrom } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/admin-container/admin-container.component').then(
        (m) => m.AdminContainerComponent,
      ),
    pathMatch: 'full',
    // The lazy AdminAppModule gave the admin pages their own injector with
    // these modules' services (MatDialog, MatSnackBar, Dialog, Overlay,
    // DragDrop, ErrorStateMatcher, chip defaults and others). The route keeps
    // that same injector, so these services keep the same instances.
    providers: [
      importProvidersFrom(
        MatDialogModule,
        MatSnackBarModule,
        MatChipsModule,
        DragDropModule,
        A11yModule,
      ),
    ],
  },
];
