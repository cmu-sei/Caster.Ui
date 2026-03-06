// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { ProjectImportComponent } from './project-import.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectObjectType } from '../../../state';

const sharedImports = [
  ReactiveFormsModule,
  MatFormFieldModule,
  MatSlideToggleModule,
  MatButtonModule,
];

describe('ProjectImportComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ProjectImportComponent, {
      declarations: [ProjectImportComponent],
      imports: sharedImports,
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display import heading with name', async () => {
    await renderComponent(ProjectImportComponent, {
      declarations: [ProjectImportComponent],
      imports: sharedImports,
      componentProperties: {
        id: 'p-1',
        name: 'My Project',
        type: ProjectObjectType.PROJECT,
      },
    });

    expect(
      screen.getByText(/Import Project: My Project/)
    ).toBeInTheDocument();
  });

  it('should show Choose File, Import, and Cancel buttons', async () => {
    await renderComponent(ProjectImportComponent, {
      declarations: [ProjectImportComponent],
      imports: sharedImports,
      componentProperties: {
        id: 'p-1',
        name: 'Test',
        type: ProjectObjectType.PROJECT,
      },
    });

    expect(screen.getByText('Choose File')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should have Import button disabled when no file selected', async () => {
    const { container } = await renderComponent(ProjectImportComponent, {
      declarations: [ProjectImportComponent],
      imports: sharedImports,
      componentProperties: {
        id: 'p-1',
        name: 'Test',
        type: ProjectObjectType.PROJECT,
      },
    });

    const importBtn = screen.getByText('Import').closest('button');
    expect(importBtn.disabled).toBe(true);
  });
});
