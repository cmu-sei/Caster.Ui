// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ProjectRolesComponent } from './project-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';

describe('ProjectRolesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ProjectRolesComponent, {
      declarations: [ProjectRolesComponent],
      imports: [MatTableModule, MatCheckboxModule],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
