// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ProjectComponent } from './project.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('ProjectComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ProjectComponent, {
      declarations: [ProjectComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should pass project to child component', async () => {
    const project = { id: 'p-1', name: 'Test Project' } as any;
    const projectUI = {
      openTabs: [],
      selectedTab: 0,
    } as any;

    const { fixture } = await renderComponent(ProjectComponent, {
      declarations: [ProjectComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: {
        project,
        projectUI,
        loading: false,
      },
    });

    expect(fixture.componentInstance.project).toEqual(project);
    expect(fixture.componentInstance.projectUI).toEqual(projectUI);
  });
});
