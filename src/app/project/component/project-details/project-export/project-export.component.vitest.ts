// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { ProjectExportComponent } from './project-export.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectObjectType } from '../../../state';

const sharedImports = [
  ReactiveFormsModule,
  MatFormFieldModule,
  MatSelectModule,
  MatSlideToggleModule,
  MatButtonModule,
];

describe('ProjectExportComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ProjectExportComponent, {
      declarations: [ProjectExportComponent],
      imports: sharedImports,
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display export heading with name', async () => {
    await renderComponent(ProjectExportComponent, {
      declarations: [ProjectExportComponent],
      imports: sharedImports,
      componentProperties: {
        id: 'p-1',
        name: 'Test Project',
        type: ProjectObjectType.PROJECT,
      },
    });

    expect(screen.getByText(/Export Project: Test Project/)).toBeInTheDocument();
  });

  it('should show Export and Cancel buttons', async () => {
    await renderComponent(ProjectExportComponent, {
      declarations: [ProjectExportComponent],
      imports: sharedImports,
      componentProperties: {
        id: 'p-1',
        name: 'Test',
        type: ProjectObjectType.PROJECT,
      },
    });

    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show archive type selector for non-file types', async () => {
    const { container } = await renderComponent(ProjectExportComponent, {
      declarations: [ProjectExportComponent],
      imports: sharedImports,
      componentProperties: {
        id: 'd-1',
        name: 'Dir',
        type: ProjectObjectType.DIRECTORY,
      },
    });

    expect(screen.getByText('Archive Type')).toBeInTheDocument();
  });

  it('should hide archive type selector for file type', async () => {
    await renderComponent(ProjectExportComponent, {
      declarations: [ProjectExportComponent],
      imports: sharedImports,
      componentProperties: {
        id: 'f-1',
        name: 'File',
        type: ProjectObjectType.FILE,
      },
    });

    expect(screen.queryByText('Archive Type')).not.toBeInTheDocument();
  });
});
