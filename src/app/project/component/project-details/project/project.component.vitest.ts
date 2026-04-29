// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ProjectComponent } from './project.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('ProjectComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderComponent(ProjectComponent, {
      declarations: [ProjectComponent],
      schemas: [NO_ERRORS_SCHEMA],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });
});
