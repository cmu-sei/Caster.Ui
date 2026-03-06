// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { ProjectBreadcrumbComponent } from './project-breadcrumb.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectObjectType, Breadcrumb } from '../../../state';

const sharedImports = [CommonModule, MatIconModule, MatButtonModule];

describe('ProjectBreadcrumbComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ProjectBreadcrumbComponent, {
      declarations: [ProjectBreadcrumbComponent],
      imports: sharedImports,
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display breadcrumb names with button style', async () => {
    const breadcrumbs: Breadcrumb[] = [
      { id: 'd1', name: 'Root Dir', type: ProjectObjectType.DIRECTORY },
      { id: 'f1', name: 'main.tf', type: ProjectObjectType.FILE },
    ];

    await renderComponent(ProjectBreadcrumbComponent, {
      declarations: [ProjectBreadcrumbComponent],
      imports: sharedImports,
      componentProperties: {
        useButtonStyleBreadcrumbs: true,
        breadcrumbs,
      },
    });

    expect(screen.getByText(/Root Dir/)).toBeInTheDocument();
    expect(screen.getByText(/main\.tf/)).toBeInTheDocument();
  });

  it('should display breadcrumb names with span style', async () => {
    const breadcrumbs: Breadcrumb[] = [
      { id: 'w1', name: 'My Workspace', type: ProjectObjectType.WORKSPACE },
    ];

    await renderComponent(ProjectBreadcrumbComponent, {
      declarations: [ProjectBreadcrumbComponent],
      imports: sharedImports,
      componentProperties: {
        useButtonStyleBreadcrumbs: false,
        breadcrumbs,
      },
    });

    expect(screen.getByText(/My Workspace/)).toBeInTheDocument();
  });

  it('should render empty when no breadcrumbs', async () => {
    const { container } = await renderComponent(ProjectBreadcrumbComponent, {
      declarations: [ProjectBreadcrumbComponent],
      imports: sharedImports,
      componentProperties: {
        useButtonStyleBreadcrumbs: true,
        breadcrumbs: [],
      },
    });

    expect(container.querySelector('button[mat-button]')).toBeNull();
  });
});
