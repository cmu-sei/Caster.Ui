// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ActiveRunsComponent } from './active-runs.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('ActiveRunsComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ActiveRunsComponent, {
      declarations: [ActiveRunsComponent],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
