// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AdminGroupsMemberListComponent } from './admin-groups-member-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';

describe('AdminGroupsMemberListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(AdminGroupsMemberListComponent, {
      declarations: [AdminGroupsMemberListComponent],
      imports: [MatTableModule, MatSortModule, MatPaginatorModule],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
