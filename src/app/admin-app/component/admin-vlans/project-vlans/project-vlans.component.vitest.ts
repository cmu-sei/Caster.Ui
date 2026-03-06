// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ProjectVlansComponent } from './project-vlans.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';

describe('ProjectVlansComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ProjectVlansComponent, {
      declarations: [ProjectVlansComponent],
      imports: [MatTableModule, MatSelectModule],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
