// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AdminRolesComponent } from './admin-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('AdminRolesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(AdminRolesComponent, {
      declarations: [AdminRolesComponent],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
