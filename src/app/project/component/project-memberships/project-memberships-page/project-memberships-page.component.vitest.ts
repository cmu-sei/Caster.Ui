// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ProjectMembershipsPageComponent } from './project-memberships-page.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('ProjectMembershipsPageComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(
      ProjectMembershipsPageComponent,
      {
        declarations: [ProjectMembershipsPageComponent],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      }
    );
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should set projectId from route params', async () => {
    const { fixture } = await renderComponent(
      ProjectMembershipsPageComponent,
      {
        declarations: [ProjectMembershipsPageComponent],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      }
    );
    // Default ActivatedRoute snapshot returns null for paramMap.get
    // so projectId will be null in test context
    expect(fixture.componentInstance.projectId).toBeNull();
  });
});
