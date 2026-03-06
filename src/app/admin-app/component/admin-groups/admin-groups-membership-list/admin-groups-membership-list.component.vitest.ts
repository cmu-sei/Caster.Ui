// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AdminGroupsMembershipListComponent } from './admin-groups-membership-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('AdminGroupsMembershipListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(AdminGroupsMembershipListComponent, {
      declarations: [AdminGroupsMembershipListComponent],
      imports: [MatTableModule, MatSortModule, MatPaginatorModule, MatSnackBarModule],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
