// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { ProjectService } from 'src/app/project/state/project.service';
import { ProjectQuery } from 'src/app/project/state/project-query.service';
import { AdminProjectsComponent } from './admin-projects.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('AdminProjectsComponent', () => {
  it('creates and loads projects on init', async () => {
    const loadProjects = vi.fn(() => of([]));
    const { fixture } = await renderComponent(AdminProjectsComponent, {
      declarations: [AdminProjectsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ProjectService, useValue: { loadProjects } },
        {
          provide: ProjectQuery,
          useValue: { selectAll: () => of([]), selectLoading: () => of(false) },
        },
      ],
    });
    expect(fixture.componentInstance).toBeTruthy();
    expect(loadProjects).toHaveBeenCalledWith(false);
  });
});
